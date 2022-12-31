"use strict"

var log = () => { /* do nothing */ }

const path = require("path")
const fs = require("fs")
var express = require("express")
const http = require('http')
const bodyParser = require('body-parser')
var _ = require('lodash')
const {google} = require('googleapis')
const {GoogleAuth} = require('google-auth-library')
const {smarthome} = require('actions-on-google')

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
    this.actions = smarthome()
    this.homegraph = null
    this.EXT = {
      "EXT-Screen": false,
      "EXT-Volume": false,
      "EXT-Pages": false
    }
    this.user = {
      "password": this.config.password,
      "devices": [
          "MMM-GoogleAssistant"
      ]
    }
    this.device = {
      "type": "action.devices.types.TV",
      "traits": [],
      "name": {
          "name": "Jarvis",
          "defaultNames": [
            "Jarvis",
            "MagicMirror",
            "Mirror"
          ],
          "nicknames": [
            "Jarvis",
            "MagicMirror",
            "Mirror"
          ]
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
    this.keyFile = null
    let file = path.resolve(__dirname, "../credentials.json")
    if (fs.existsSync(file)) {
      this.keyFile = file
      this.init = true
    } else {
      this.callback.Alert("Hey! credentials.json: file not found!")
      this.init = false
    }
  }

  start() {
    console.log("[SMARTHOME] Starting Server...")
    this.actionsOnGoogle()
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
          let user = this.get_user(form["username"])
          if (!user || this.user.password != form["password"]) {
            return res.sendFile(this.websiteDir+ "/login.html")
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
            let access_token = this.random_string(32)
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

      .post("/", this.actions)

      .use((req, res) => {
        console.warn("[SMARTHOME] Don't find:", req.url, req.body)
        res.status(404).sendFile(this.websiteDir+ "/404.html")
      })

    this.server.listen(this.config.port, "127.0.0.1", async () => {
      console.log("[SMARTHOME] Start listening on http://127.0.0.1:"+this.config.port)
      this.homegraph = google.homegraph({
        version: 'v1',
        auth: new GoogleAuth({
          keyFile: this.keyFile,
          scopes: 'https://www.googleapis.com/auth/homegraph'
        })
      })
      this.requestSync()
    })
  }

  /** actions on google **/
  actionsOnGoogle() {
    this.actions.onExecute((body, headers) => {
      log("[actionsOnGoogle] Execute")
      log("[EXECUTE] Request:", JSON.stringify(body))
      let user_id = this.check_token(headers)
      if (!user_id) {
        console.log("[SMARTHOME] [actionsOnGoogle] [EXECUTE] Error: user_id not found!")
        return {} // maybe return error ??
      }
      var result = {}
      result['payload'] = {}
      result['payload']['commands'] = []
      let inputs = body["inputs"]
      let device_id = inputs[0].payload.commands[0].devices[0].id || null
      let custom_data = inputs[0].payload.commands[0].devices[0].hasOwnProperty("customData") ? inputs[0].payload.commands[0].devices[0].hasOwnProperty("customData") : this.SmartHome
      log("[EXECUTE] custom_data:", custom_data, device_id)
      let command = inputs[0].payload.commands[0].execution[0].command || null
      let params = inputs[0].payload.commands[0].execution[0].hasOwnProperty("params") ? inputs[0].payload.commands[0].execution[0].params : null
      let action_result = this.execute(custom_data, command, params, this.callback)
      action_result['ids'] = [device_id]
      result['payload']['commands'].push(action_result)
      log("[EXECUTE] Send Result:", JSON.stringify(result))
      return result
    })

    this.actions.onQuery((body, headers) => {
      log("[actionsOnGoogle] Query")
      log("[QUERY] Request:", JSON.stringify(body))
      let user_id = this.check_token(headers)
      if (!user_id) {
        console.log("[SMARTHOME] [actionsOnGoogle] [QUERY] Error: user_id not found!")
        return {} // maybe return error ??
      }
      var result = {}
      result['payload'] = {}
      result['payload']['devices'] = {}
      let inputs = body["inputs"]
      let device_id = inputs[0].payload.devices[0].id || null
      log("[QUERY] device_id:", device_id)
      let custom_data = inputs[0].payload.devices[0].hasOwnProperty("customData") ? inputs[0].payload.devices[0].customData : this.SmartHome
      log("[QUERY] custom_data:", custom_data)
      result['payload']['devices'][device_id] = this.query(custom_data)
      log("[QUERY] Send Result:", JSON.stringify(result))
      return result
    })

    this.actions.onSync((body, headers) => {
      log("[actionsOnGoogle] Sync")
      log("[SYNC] Request:", JSON.stringify(body))
      let user_id = this.check_token(headers)
      if (!user_id) {
        console.log("[SMARTHOME] [actionsOnGoogle] [SYNC] Error: user_id not found!")
        return {} // maybe return error ??
      }
      var result = {}
      result["requestId"] = body["requestId"]
      result['payload'] = {"agentUserId": user_id, "devices": []}
      let user = this.get_user(user_id)
      let device = this.get_device(user.devices[0])
      result['payload']['devices'].push(device)
      log("[SYNC] Send Result:", JSON.stringify(result))
      return result
    })

    this.actions.onDisconnect((body, headers) => {
      log("[actionsOnGoogle] Disconnect")
      let access_token = this.get_token(headers)
      if (fs.existsSync(this.tokensDir + "/" + access_token)) {
        fs.unlinkSync(this.tokensDir + "/" + access_token)
        log("Deleted:", access_token)
      }
      return {}
    })

  }

  /** DataBase update **/
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
    if (this.init) this.updateGraph()
  }

  /** HomeGraph dial **/
  async requestSync() {
    if (!this.init) return
    console.log("[SMARTHOME] [requestSync] in Progress...")
    try {
      let body = {
        requestBody: {
          agentUserId: "MagicMirror",
          async: false
        }
      }
      const res = await this.homegraph.devices.requestSync(body)
      console.log("[SMARTHOME] [requestSync] Done.", res.data, res.status, res.statusText)
    } catch (e) { console.error("[SMARTHOME] [requestSync] Error:", e.code ? e.code : e, e.errors? e.errors : "") }
  }

  async updateGraph() {
    if (!_.isEqual(this.SmartHome, this.oldSmartHome)) {
      try {
        let state = {
          online: true
        }
        if (this.EXT["EXT-Screen"]) {
          state.on = (this.SmartHome.Screen == "ON") ? true : false
        }
        if (this.EXT["EXT-Volume"]) {
          state.currentVolume = this.SmartHome.Volume
        }
        if (this.EXT["EXT-Pages"]) {
          state.currentInput = "page " + this.SmartHome.Page
        }
        let body = {
          requestBody: {
            agentUserId: "MagicMirror",
            requestId: "bugsounetGA-"+Date.now(),
            payload: {
              devices: {
                states: {
                  "MMM-GoogleAssistant": state
                }
              }
            }
          }
        }
        const res = await this.homegraph.devices.reportStateAndNotification(body)
        log("[homeGraph] [SEND]", res.data, state, res.status, res.statusText)
      } catch (e) { console.log("[SMARTHOME] [homeGraph]", e.code ? e.code : e, e.errors? e.errors : "") }
    }
  }

  /** Search installed plugins and set any values **/
  set(GW) {
    log("Received first GW status", GW)
    this.EXT = {
      "EXT-Screen": GW["EXT-Screen"].hello,
      "EXT-Volume": GW["EXT-Volume"].hello,
      "EXT-Pages": GW["EXT-Pages"].hello
    }
    this.SmartHome.Screen = (GW["EXT-Screen"].power == true) ? "ON" : "OFF"
    this.SmartHome.Volume = GW["EXT-Volume"].speaker
    this.SmartHome.Page = GW["EXT-Pages"].actual
    this.SmartHome.MaxPages = GW["EXT-Pages"].total
    if (this.EXT["EXT-Screen"]) {
      this.device.traits.push("action.devices.traits.OnOff")
    }
    if (this.EXT["EXT-Volume"]) {
      if (!this.device.attributes) this.device.attributes = {}
      this.device.traits.push("action.devices.traits.Volume")
      this.device.attributes.volumeMaxLevel = 100
      this.device.attributes.volumeDefaultPercentage = this.SmartHome.Volume
      this.device.attributes.levelStepSize = 5
    }
    if (this.EXT["EXT-Pages"]) {
      if (!this.device.attributes) this.device.attributes = {}
      this.device.traits.push("action.devices.traits.InputSelector")
      this.device.attributes.orderedInputs = true
      this.device.attributes.availableInputs = []
      for (let i = 0; i < this.SmartHome.MaxPages; i++) {
        let input = {}
        input.key = "page " + i
        input.names = []
        input.names[0] = {}
        input.names[0].lang = "fr" // <--- change to language
        input.names[0].name_synonym = []
        input.names[0].name_synonym[0] = "page " + i
        this.device.attributes.availableInputs.push(input)
      }
    }
    log("Your device is now", this.device)
  }

  /** Tools **/
  logRequest(req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    log("[" + ip + "][" + req.method + "] " + req.url)
    next()
  }

  query(data) {
    let result = { "online": true }
    if (this.EXT["EXT-Screen"]) {
      result.on = (data["Screen"] == "ON") ? true : false
    }
    if (this.EXT["EXT-Volume"]) {
      result.volumeLevel = data.Volume
    }
    if (this.EXT["EXT-Pages"]) {
      result.currentInput = "page " + data.Page
    }
    log("query result", result)
    return result
  }

  execute(data, command, params, callback) {
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
    } else if (command == "action.devices.commands.SetInput") {
      log("SetInput", params)
      let input = params.newInput.split(" ")
      callback.setPage(input[1])
      return {"status": "SUCCESS", "states": { "online": true , "newInput": params.newInput}}
    } else if (command == "action.devices.commands.NextInput") {
      log("NextInput", params)
      callback.setNextPage()
      return {"status": "SUCCESS", "states": { "online": true }}
    } else if (command == "action.devices.commands.PreviousInput") {
      log("PreviousInput", params)
      callback.setPreviousPage()
      return {"status": "SUCCESS", "states": { "online": true }}
    } else {
      return {"status": "ERROR"}
    }
  }

  get_user(username) {
    if (username == this.config.username) {
      return this.user
    } else {
      return null
    }
  }

  get_device(device_id) {
    if (device_id == "MMM-GoogleAssistant") {
      let data = this.device
      data["id"] = device_id
      return data
    } else {
      return null
    }
  }

  /** token rules **/
  check_token(headers) {
    let access_token = this.get_token(headers)
    if (!access_token) {
      console.error("[SMARTHOME] No token found in headers")
      return null
    }
    if (fs.existsSync(this.tokensDir + "/" + access_token)) {
      let user = fs.readFileSync(this.tokensDir + "/" +access_token, 'utf8')
      return user
    } else {
      console.error("[SMARTHOME] Token not found in database", access_token)
      return null
    }
  }

  get_token(headers) {
    if (!headers) return null
    const auth = headers.authorization
    let parts = auth.split(" ",2)
    if (auth && parts.length == 2 && parts[0].toLowerCase() == 'bearer') {
      return parts[1]
    } else {
      return null
    }
  }

  random_string(length=8) {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const charactersLength = characters.length
    for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }

  serialize(obj) {
    let str = '?' + Object.keys(obj).reduce(function(a, k){
      a.push(k + '=' + encodeURIComponent(obj[k]))
      return a
    }, []).join('&')
    return str
  }
}

module.exports = SMARTHOME
