/**************************
*  EXT-SmartHome v1.0     *
*  Bugsounet              *
*  12/2022                *
***************************/

var log = () => { /* do nothing */ }

var express = require("express")
const http = require('http')
const bodyParser = require('body-parser')

const fs = require("fs")
const path = require("path")

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function() {
    this.server= null
    this.devicesDir = null
    this.tokensDir= null
    this.usersDir= null
    this.websiteDir = null
    this.SmartHome = {
      Screen : "ON",
      Volume : 100,
      Page: 0
    }
    this._Callbacks = {
      screen: (state) => {
        log("callback screen:", state)
        this.sendSocketNotification("SCREEN", state)
      }
    }
    this.characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    this.last_code = null
    this.last_code_user = null
    this.last_code_time = null
  },

  initialize: function(payload) {
    console.log("[SMARTHOME] EXT-SmartHome Version:", require('./package.json').version, "rev:", require('./package.json').rev)
    this.config = payload
    if (payload.debug) {
      log = (...args) => { console.log("[SMARTHOME]", ...args) }
    }
    console.log("[SMARTHOME] Start app...")
    this.devicesDir = __dirname + "/database/devices/"
    this.tokensDir= __dirname + "/database/tokens/"
    this.usersDir= __dirname + "/database/users/"
    this.websiteDir = __dirname + "/website/"
    this.app = express()
    this.server = http.createServer(this.app)
    this.Setup()
  },

  Setup: function() {
    this.app
      .use(this.logRequest)
      .use('/css', express.static(this.websiteDir))
      .use(bodyParser.json())
      .use(bodyParser.urlencoded({ extended: true }))
      .use(express.json())

      /** OAuth2 Server **/
      .get("/auth/", (req,res) => {
        res.sendFile(this.websiteDir+ "login.html")
      })
      
      .post("/auth/", (req,res) => {
        let form = req.body
        let args = req.query
        if (form["username"] && form["password"] && args["state"] && args["response_type"] && args["response_type"] == "code" && args["client_id"] == this.config.CLIENT_ID){
          let user = this.get_user(form["username"])
          if (!user || user["password"] != form["password"]) {
            return res.sendFile(this.websiteDir+ "login.html")
          }
          this.last_code = this.random_string(8)
          this.last_code_user = form["username"]
          this.last_code_time = (new Date()).getTime() / 1000
          let params = {
            'state': args["state"], 
            'code': this.last_code,
            'client_id': this.config.CLIENT_ID
          }
          log("generate Code", this.last_code)
          log("params:", params)
          log("link:", args["redirect_uri"] + this.serialize(params))
          res.status(301).redirect(args["redirect_uri"] + this.serialize(params))
        } else {
          res.status(400).send("Invalid request")
        }
      })
      
      .post("/token/", (req,res) => {
        let form = req.body
        if (form["grant_type"] && form["grant_type"] == "authorization_code" && form["code"] && form["code"] == this.last_code) {
          let time = (new Date()).getTime() / 1000
          if (time - this.last_code_time > 10) {
            log("Invalid code (timeout)")
            res.status(403).send("Invalid code")
          } else {
            let access_token = this.random_string(32)
            fs.writeFileSync(this.tokensDir + access_token, this.last_code_user, { encoding: "utf8"} )
            log("Send Token:", {"access_token": access_token})
            res.json({"access_token": access_token})
          }
        } else {
          log("Invalid code")
          res.status(403).send("Invalid code")
        }
      })

      /** fulfillment Server **/
      .get("/", (req,res) => {
        res.send("[EXT-SmartHome] Your smart home server is ready.")
      })

      .post("/", async (req,res) => {
        let Headers = req.headers
        var user_id = this.check_token(Headers)
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
            let user = this.get_user(user_id)
            await user['devices'].reduce(async (ref, device_id) => {
              let device = this.get_device(device_id)
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
              log("Loading:", this.devicesDir + device_id+ ".mjs")
              try {
                let deviceModule = await import(this.devicesDir + device_id+ ".mjs")
                log("Loaded!")
                result['payload']['devices'][device_id] = deviceModule.query(custom_data)
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
                log("custom_data:", custom_data)
                log("Loading:", this.devicesDir + device_id+ ".mjs")
                try {
                  let deviceModule = await import(this.devicesDir + device_id+ ".mjs")
                  log("Loaded!")
                  await command['execution'].reduce(async (ref, exec) => {
                    let comm = exec['command']
                    let params = exec.hasOwnProperty("params") ? exec.params : null
                    let action_result = deviceModule.action(custom_data, comm, params, this._Callbacks.screen)
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
            let access_token = this.get_token()
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

     .use(function(req, res) {
        console.warn("[SMARTHOME] Don't find:", req.url, req.body)
        res.status(404).send("Page not found!")
      })
    this.server.listen(this.config.port, "127.0.0.1", async () => {
      console.log("[SMARTHOME] Start listening on http://127.0.0.1:"+this.config.port) 
    })
  },

  logRequest: function(req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    log("[" + ip + "][" + req.method + "] " + req.url)
    next()
  },

  get_user: function(username) {
     if (fs.existsSync(this.usersDir + username + ".json")) {
       let user = fs.readFileSync(this.usersDir + username + ".json", 'utf8')
       return JSON.parse(user)
     } else {
       return null
     }
  },

  get_device: function(device_id) {
    if (fs.existsSync(this.devicesDir + device_id + ".json")) {
      let data = {}
      let device = fs.readFileSync(this.devicesDir + device_id + ".json", 'utf8')
      data = JSON.parse(device)
      data["id"] = device_id
      return data
    } else {
      return null
    }
  },

  /** token rules **/
  check_token: function(headers) {
    let access_token = this.get_token(headers)
    if (!access_token) return console.error("[SMARTHOME] No token found in headers")
    if (fs.existsSync(this.tokensDir + access_token)) {
      let user = fs.readFileSync(this.tokensDir + access_token, 'utf8')
      return user
    }
    else { 
      console.error("[SMARTHOME] Token not found in database", access_token)
      return null
    }
  },
  
  get_token: function(headers) {
    if (!headers) return null
    const auth = headers.authorization
    let parts = auth.split(" ",2)
    if (auth && parts.length == 2 && parts[0].toLowerCase() == 'bearer') {
      return parts[1]
    } else {
      return null
    }
  },

  random_string: function (length=8) {
      let result = ''
      const charactersLength = this.characters.length
      for ( let i = 0; i < length; i++ ) {
          result += this.characters.charAt(Math.floor(Math.random() * charactersLength))
      }
      return result
  },

  serialize: function(obj ) {
    let str = '?' + Object.keys(obj).reduce(function(a, k){
        a.push(k + '=' + encodeURIComponent(obj[k]));
        return a;
    }, []).join('&');
    return str;
  },

  socketNotificationReceived: function(noti, payload) {
    switch (noti) {
      case "INIT":
        this.initialize(payload)
        break
      case "SCREEN":
        this.SmartHome.Screen = payload
        break
    }
  }
})
