var log = () => { /* do nothing */ }
const path = require("path")
const fs = require("fs")
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

class DATA {
  constructor(config, EXT, initData) {
    this.config = config
    this.initData= initData
    this.EXT = EXT
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME]", ...args) }
    this.tokensDir = path.resolve(__dirname + "/../tokens/")
    this.user = {
      "password": this.config.password,
      "devices": [
          "MMM-GoogleAssistant"
      ]
    }

    log("Configure DATA for:", this.EXT)
    log("initData", initData)
    this.device = {
      "type": "action.devices.types.TV",
      "traits": [],
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
      "willReportState": false,
      "roomHint": "MMM-GoogleAssistant",
      "deviceInfo": {
          "manufacturer": "@bugsounet",
          "model": "MMM-GoogleAssistant",
          "hwVersion": "1",
          "swVersion": "1"
      }
    }
    if (this.EXT["EXT-Screen"]) {
      this.device.traits.push("action.devices.traits.OnOff")
    }
    if (this.EXT["EXT-Volume"]) {
      if (!this.device.attributes) this.device.attributes = {}
      this.device.traits.push("action.devices.traits.Volume")
      this.device.attributes.volumeMaxLevel = 100
      this.device.attributes.volumeDefaultPercentage = this.initData.Volume
      this.device.attributes.levelStepSize = 5
    }
    if (this.EXT["EXT-Pages"]) {
      if (!this.device.attributes) this.device.attributes = {}
      this.device.traits.push("action.devices.traits.InputSelector")
      this.device.attributes.orderedInputs = true
      this.device.attributes.availableInputs = []
      for (let i = 0; i < this.initData.MaxPages; i++) {
        let input = {}
        input.key = "page " + i
        input.names = []
        input.names[0] = {}
        input.names[0].lang = "fr"
        input.names[0].name_synonym = []
        input.names[0].name_synonym[0] = "page " + i
        this.device.attributes.availableInputs.push(input)
      }
    }
    log("Your device is now", this.device)
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
      return {"status": "SUCCESS", "states": { "online": true , "currentInput": params.newInput}}
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
    log("get_device", device_id)
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

  async requestSync() {
    let url = 'https://homegraph.googleapis.com/v1/devices:requestSync?key=' + this.config.API_KEY
    let payload = {"agentUserId": "MagicMirror"}
    const response = await fetch(url,
      {
        method: 'POST',
        body: JSON.stringify(payload),
	      headers: {'Content-Type': 'application/json'}
      }
    )
    if (response.ok) {
      const data = await response.json()
      console.log("[SMARTHOME] requestSync Done.", data)
    } else {
      console.error("[SMARTHOME] requestSync Error:", response.status, response.statusText)
      resolve()
    }
  }
}
module.exports = DATA
