/**************************
*  EXT-SmartHome v1.0     *
*  Bugsounet              *
*  12/2022                *
***************************/
"use strict"

var log = () => { /* do nothing */ }

var express = require("express")
const http = require('http')
const bodyParser = require('body-parser')
var _ = require('lodash')
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
    this.oldSmartHome = {}
    this._Callbacks = {
      screen: (state) => {
        log("callback screen:", state)
        this.sendSocketNotification("SCREEN", state)
      },
      volume: (level) => {
        log("volume:", level)
        this.sendSocketNotification("VOLUME", level)
      },
      volumeUp: () => {
        log("volume Up")
        this.sendSocketNotification("VOLUME-UP")
      },
      volumeDown: () => {
        log("volume Down")
        this.sendSocketNotification("VOLUME-DOWN")
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
    this.tokensDir= __dirname + "/tokens/"
    this.websiteDir = __dirname + "/website/"
    this.user = {}
    this.device = {}
    this.app = express()
    this.server = http.createServer(this.app)
    this.setData()
    this.Setup()
  },

  setData: function() {
    this.user = {
      "password": this.config.password,
      "devices": [
          "MMM-GoogleAssistant"
      ]
    }
    this.device = {
      "type": "action.devices.types.TV",
      "traits": [
          "action.devices.traits.OnOff",
          "action.devices.traits.Volume",
          "action.devices.traits.InputSelector"
      ],
      "name": {
          "name": "Jarvis",
          "defaultNames": [
            "Mirror",
            "MagicMirror",
            "Jarvis"
          ],
          "nicknames": [
            "Jarvis",
            "MagicMirror",
            "Mirror"
          ]
      },
      "attributes": {
        "availableInputs": [
          {
            "key": "page 0",
            "names": [
              {
                "lang": "en",
                "name_synonym": [
                  "page 0"
                ]
              }
            ]
          },
          {
            "key": "page 1",
            "names": [
              {
                "lang": "en",
                "name_synonym": [
                  "page 1"
                ]
              }
            ]
          }
        ],
        "orderedInputs": true,
        "volumeMaxLevel": 100,
        "volumeDefaultPercentage": 100,
        "levelStepSize": 5
      },
      "willReportState": false,
      "roomHint": "MMM-GoogleAssistant",
      "deviceInfo": {
          "manufacturer": "@bugsounet",
          "model": "MMM-GoogleAssistant",
          "hwVersion": "1",
          "swVersion": "1"
      }
    }
    this.query = (data) => {
      let Result = false
      if (data["Screen"] == "ON") {
        Result = true
      }
      return {"on": Result, "online": true, "volumeLevel": data.Volume}
    }
    this.execute = (data, command, params, callback) => {
      if (command == "action.devices.commands.OnOff") {
        if (params['on']) callback.screen("ON")
        else callback.screen("OFF")
        return {"status": "SUCCESS", "states": {"on": params['on'], "online": true}}
      } else if (command == "action.devices.commands.volumeRelative") {
        let level = 0
        if (params.volumeRelativeLevel > 0) {
          level = data.Volume +5
          if (level > 100) level = 100
          callback.volumeUp()
        } else {
          level = data.Volume -5
          if (level < 0) level = 0
          callback.volumeDown()
        }
        return {"status": "SUCCESS", "states": {"online": true, "volumeLevel": level}}
      } else if (command == "action.devices.commands.setVolume") {
        callback.volume(params.volumeLevel)
        return {"status": "SUCCESS", "states": {"online": true, "volumeLevel": params.volumeLevel}}
      } else {
        return {"status": "ERROR"}
      }
    }
  },

  Setup: function() {
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
      .use('/assets', express.static(this.websiteDir + 'assets', options))
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
          console.log(user, this.user, form["password"])
          if (!user || this.user.password != form["password"]) {
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
          res.status(400).sendFile(this.websiteDir+ "400.html")
        }
      })
      
      .post("/token/", (req,res) => {
        let form = req.body
        if (form["grant_type"] && form["grant_type"] == "authorization_code" && form["code"] && form["code"] == this.last_code) {
          let time = (new Date()).getTime() / 1000
          if (time - this.last_code_time > 10) {
            log("Invalid code (timeout)")
            res.status(403).sendFile(this.websiteDir+ "403.html")
          } else {
            let access_token = this.random_string(32)
            fs.writeFileSync(this.tokensDir + access_token, this.last_code_user, { encoding: "utf8"} )
            log("Send Token:", {"access_token": access_token})
            res.json({"access_token": access_token})
          }
        } else {
          log("Invalid code")
          res.status(403).sendFile(this.websiteDir+ "403.html")
        }
      })

      /** fulfillment Server **/
      .get("/", (req,res) => {
        res.sendFile(this.websiteDir+ "works.html")
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
              try {
                result['payload']['devices'][device_id] = this.query(custom_data)
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
                    let action_result = this.execute(custom_data, comm, params, this._Callbacks)
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
            let access_token = this.get_token(Headers)
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
        res.status(404).sendFile(this.websiteDir+ "404.html")
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
    if (username == this.config.username) {
      return this.user
    } else {
      return null
    }
  },

  get_device: function(device_id) {
    log("get_device", device_id)
    if (device_id == "MMM-GoogleAssistant") {
      let data = this.device
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
      case "GATEWAYDB":
        this.refreshDB(payload)
        break
    }
  },

  refreshDB: function(data) {
    this.oldSmartHome = {
      Screen: this.SmartHome.Screen,
      Volume: this.SmartHome.Volume,
      Page: 0
    }

    this.SmartHome.Screen = (data["EXT-Screen"].power == true) ? "ON" : "OFF"
    this.SmartHome.Volume = data["EXT-Volume"].speaker
    this.updateGraph()
  },

  updateGraph: function() {
     if (!_.isEqual(this.SmartHome, this.oldSmartHome)) {
      log("Change detected... @toCode: Send notification to Google homegraph server")
    }

  }
})
