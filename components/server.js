"use strict"

var log = () => { /* do nothing */ }

const path = require("path")
const fs = require("fs")
var express = require("express")
const http = require('http')
const bodyParser = require('body-parser')
const data = require("../components/data.js")
var _ = require('lodash')

class SMARTHOME {
  constructor(config, cb = ()=>{}) {
    this.config = config
    this.callback = cb
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME]", ...args) }
    this.tokensDir = path.resolve(__dirname + "/../tokens/")
    this.websiteDir =  path.resolve(__dirname + "/../website/")
    this.last_code = null
    this.last_code_user = null
    this.last_code_time = null
    this.SmartHome = {
      Screen : "ON",
      Volume : 100,
      Page: 0,
      MaxPages: 0
    }
    this.oldSmartHome = {}
    this.app = express()
    this.server = http.createServer(this.app)
    this.data = null
  }

  start() {
    console.log("[SMARTHOME] Starting Server...")
    var options = {
      dotfiles: 'ignore',
      etag: false,
      extensions: ["css", "js"],
      index: false,
      maxAge: '1d',
      redirect: false,
      setHeaders: function (res, path, stat) {
        res.set('x-timestamp', Date.now())
      }
    }
    this.app
      .use(this.logRequest)
      .use('/css', express.static(this.websiteDir))
      .use('/assets', express.static(this.websiteDir + '/assets', options))
      .use(bodyParser.json())
      .use(bodyParser.urlencoded({ extended: true }))
      .use(express.json())

      /** OAuth2 Server **/
      .get("/auth/", (req,res) => {
        res.sendFile(this.websiteDir+ "/login.html")
      })

      .post("/auth/", (req,res) => {
        let form = req.body
        let args = req.query
        if (form["username"] && form["password"] && args["state"] && args["response_type"] && args["response_type"] == "code" && args["client_id"] == this.config.CLIENT_ID){
          let user = this.data.get_user(form["username"])
          if (!user || this.data.user.password != form["password"]) {
            return res.sendFile(this.websiteDir+ "/login.html")
          }
          this.last_code = this.data.random_string(8)
          this.last_code_user = form["username"]
          this.last_code_time = (new Date()).getTime() / 1000
          let params = {
            'state': args["state"],
            'code': this.last_code,
            'client_id': this.config.CLIENT_ID
          }
          log("generate Code", this.last_code)
          log("params:", params)
          log("link:", args["redirect_uri"] + this.data.serialize(params))
          res.status(301).redirect(args["redirect_uri"] + this.data.serialize(params))
        } else {
          res.status(400).sendFile(this.websiteDir+ "/400.html")
        }
      })

      .post("/token/", (req,res) => {
        let form = req.body
        if (form["grant_type"] && form["grant_type"] == "authorization_code" && form["code"] && form["code"] == this.last_code) {
          let time = (new Date()).getTime() / 1000
          if (time - this.last_code_time > 10) {
            log("Invalid code (timeout)")
            res.status(403).sendFile(this.websiteDir+ "/403.html")
          } else {
            let access_token = this.data.random_string(32)
            fs.writeFileSync(this.tokensDir + "/" + access_token, this.last_code_user, { encoding: "utf8"} )
            log("Send Token:", {"access_token": access_token})
            res.json({"access_token": access_token})
          }
        } else {
          log("Invalid code")
          res.status(403).sendFile(this.websiteDir+ "/403.html")
        }
      })

      /** fulfillment Server **/
      .get("/", (req,res) => {
        res.sendFile(this.websiteDir+ "/works.html")
      })

      .post("/", async (req,res) => {
        let Headers = req.headers
        var user_id = this.data.check_token(Headers)
        log("User_id:", user_id)
        if (!user_id) return res.status(403).send("Access denied")
        let r = req.body
        log("Request:", JSON.stringify(r))
        var result = {}
        result["requestId"] = r["requestId"]
        let inputs = r["inputs"]
        await inputs.reduce(async (ref, input) => {
          let intent = input["intent"]
          log("Intent:", intent)
          if (intent == "action.devices.SYNC") {
            log("Request SYNC...")
            result['payload'] = {"agentUserId": user_id, "devices": []}
            let user = this.data.get_user(user_id)
            await user['devices'].reduce(async (ref, device_id) => {
              let device = this.data.get_device(device_id)
              log("device:", device, device.id)
              result['payload']['devices'].push(device)
              log("result:", result)
            },Promise.resolve())
            log("ENDED: Request SYNC...")
          }
          if (intent == "action.devices.QUERY") {
            log("Request QUERY...")
            result['payload'] = {}
            result['payload']['devices'] = {}
            await input['payload']['devices'].reduce(async (ref, device) => {
              let device_id = device['id']
              log("device_id:", device_id)
              let custom_data = device.hasOwnProperty("customData") ? device.customData : this.SmartHome
              log("custom_data:", custom_data)
              try {
                result['payload']['devices'][device_id] = this.data.query(custom_data)
              } catch (e) { console.error(e) }
            },Promise.resolve())
            log("ENDED: Request QUERY...")
          }
          if (intent == "action.devices.EXECUTE") {
            log("Request EXECUTE...")
            result['payload'] = {}
            result['payload']['commands'] = []
            await input['payload']['commands'].reduce(async (ref, command) => {
              await command["devices"].reduce(async (ref, device) => {
                let device_id = device['id']
                log("device_id:", device_id)
                let custom_data = device.hasOwnProperty("customData") ? device.customData : this.SmartHome
                try {
                  await command['execution'].reduce(async (ref, exec) => {
                    let comm = exec['command']
                    let params = exec.hasOwnProperty("params") ? exec.params : null
                    let action_result = this.data.execute(custom_data, comm, params, this.callback)
                    action_result['ids'] = [device_id]
                    result['payload']['commands'].push(action_result)
                  },Promise.resolve())
                } catch (e) { console.error(e) }
              },Promise.resolve())
            },Promise.resolve())
            log("ENDED: Request EXECUTE...")
          }
          if (intent == "action.devices.DISCONNECT") {
            log("Request DISCONNECT...")
            let access_token = this.data.get_token(Headers)
            if (fs.existsSync(this.tokensDir + access_token)) {
              fs.unlinkSync(this.tokensDir + access_token)
              log("Deleted:", access_token)
              return {}
            }
            log("ENDED: Request DISCONNECT...")
          }
        }, Promise.resolve())
        log("Send Result:", JSON.stringify(result))
        res.json(result)
      })

     .use((req, res) => {
        console.warn("[SMARTHOME] Don't find:", req.url, req.body)
        res.status(404).sendFile(this.websiteDir+ "/404.html")
      })
    this.server.listen(this.config.port, "127.0.0.1", async () => {
      console.log("[SMARTHOME] Start listening on http://127.0.0.1:"+this.config.port)
      console.log("[SMARTHOME] requestSync in Progress...")
      this.data.requestSync()
    })
  }

  logRequest(req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    log("[" + ip + "][" + req.method + "] " + req.url)
    next()
  }

  refreshDB(data) {
    this.oldSmartHome = {
      Screen: this.SmartHome.Screen,
      Volume: this.SmartHome.Volume,
      Page: this.SmartHome.Page,
      MaxPages: this.SmartHome.MaxPages
    }
    this.SmartHome.Screen = (data["EXT-Screen"].power == true) ? "ON" : "OFF"
    this.SmartHome.Volume = data["EXT-Volume"].speaker
    this.SmartHome.Page = data["EXT-Pages"].actual
    this.SmartHome.MaxPages = data["EXT-Pages"].total
    //this.updateGraph()
  }

  updateGraph() {
     if (!_.isEqual(this.SmartHome, this.oldSmartHome)) {
      log("Change detected... @toCode: Send notification to Google homegraph server")
    }
  }

  set(GW) {
    log("Received first GW status", GW)
    let EXT = {
      "EXT-Screen": GW["EXT-Screen"].hello,
      "EXT-Volume": GW["EXT-Volume"].hello,
      "EXT-Pages": GW["EXT-Pages"].hello
    }
    this.SmartHome.Screen = (GW["EXT-Screen"].power == true) ? "ON" : "OFF"
    this.SmartHome.Volume = GW["EXT-Volume"].speaker
    this.SmartHome.Page = GW["EXT-Pages"].actual
    this.SmartHome.MaxPages = GW["EXT-Pages"].total
    this.data = new data(this.config, EXT, this.SmartHome)
  }
}

module.exports = SMARTHOME
