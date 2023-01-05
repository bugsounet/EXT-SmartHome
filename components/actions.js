"use strict"

const {smarthome} = require('actions-on-google')
const tools = require("../components/tools.js")
const dial = require("../components/dial.js")
var log = () => { /* do nothing */ }

class SMARTHOME {
  constructor(config,callback) {
    this.config = config
    this.smarthome = smarthome()
    this.callback = callback
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME] [ACTIONS]", ...args) }
    this.device = {
      "type": "action.devices.types.TV",
      "traits": [
        "action.devices.traits.Reboot"
      ],
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
          "hwVersion": require('../package.json').version,
          "swVersion": require('../package.json').rev
      }
    }
    this.EXT = {
      "EXT-Screen": false,
      "EXT-Volume": false,
      "EXT-Pages": false,
      "EXT-Alert": false,
      "EXT-Spotify": false
    }
    this.SmartHome = {}
    this.oldSmartHome = {}
    this.tools = new tools(this.config)
    this.dial = new dial(this.config)
    log("Loaded!")
  }

  actionsOnGoogle() {
    this.smarthome.onExecute((body, headers) => {
      log("[EXECUTE] Request:", JSON.stringify(body))
      let user_id = this.tools.check_token(headers)
      if (!user_id) {
        console.error("[SMARTHOME] [ACTIONS] [EXECUTE] Error: user_id not found!")
        return {} // maybe return error ??
      }
      var result = {}
      result['payload'] = {}
      result['payload']['commands'] = []
      let inputs = body["inputs"]
      let device_id = inputs[0].payload.commands[0].devices[0].id || null
      let custom_data = inputs[0].payload.commands[0].devices[0].hasOwnProperty("customData") ? inputs[0].payload.commands[0].devices[0].hasOwnProperty("customData") : this.SmartHome
      log("[EXECUTE] custom_data:", custom_data)
      let command = inputs[0].payload.commands[0].execution[0].command || null
      let params = inputs[0].payload.commands[0].execution[0].hasOwnProperty("params") ? inputs[0].payload.commands[0].execution[0].params : null
      let action_result = this.dial.execute(custom_data, command, params, this.callback)
      action_result['ids'] = [device_id]
      result['payload']['commands'].push(action_result)
      log("[EXECUTE] Send Result:", JSON.stringify(result))
      return result
    })

    this.smarthome.onQuery((body, headers) => {
      log("[QUERY] Request:", JSON.stringify(body))
      let user_id = this.tools.check_token(headers)
      if (!user_id) {
        console.error("[SMARTHOME] [ACTIONS] [QUERY] Error: user_id not found!")
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
      result['payload']['devices'][device_id] = this.dial.query(custom_data, this.EXT)
      log("[QUERY] Send Result:", JSON.stringify(result))
      return result
    })

    this.smarthome.onSync((body, headers) => {
      log("[SYNC] Request:", JSON.stringify(body))
      let user_id = this.tools.check_token(headers)
      if (!user_id) {
        console.error("[SMARTHOME] [ACTIONS] [SYNC] Error: user_id not found!")
        return {} // maybe return error ??
      }
      var result = {}
      result["requestId"] = body["requestId"]
      result['payload'] = {"agentUserId": user_id, "devices": []}
      let user = this.tools.get_user(user_id)
      let device = this.tools.get_device(user.devices[0], this.device)
      result['payload']['devices'].push(device)
      log("[SYNC] Send Result:", JSON.stringify(result))
      return result
    })

    this.smarthome.onDisconnect((body, headers) => {
      log("[Disconnect]")
      this.tools.delete_token(this.tools.get_token(headers))
      return {}
    })
  }

  setDevice(GW) {
    //log("Received first GW status", GW)
    this.EXT = {
      "EXT-Screen": GW["EXT-Screen"].hello,
      "EXT-Volume": GW["EXT-Volume"].hello,
      "EXT-Pages": GW["EXT-Pages"].hello,
      "EXT-Alert": GW["EXT-Alert"].hello,
      "EXT-Spotify": GW["EXT-Spotify"].hello
    }
    this.SmartHome.Screen = GW["EXT-Screen"].power
    this.SmartHome.Volume = GW["EXT-Volume"].speaker
    this.SmartHome.VolumeIsMuted = GW["EXT-Volume"].isMuted
    this.SmartHome.Page = GW["EXT-Pages"].actual
    this.SmartHome.MaxPages = GW["EXT-Pages"].total
    this.SmartHome.SpotifyIsConnected = GW["EXT-Spotify"].connected
    this.SmartHome.SpotifyIsRemote = GW["EXT-Spotify"].remote
    this.SmartHome.SpotifyIsPlaying = GW["EXT-Spotify"].play

    if (this.EXT["EXT-Screen"]) {
      this.device.traits.push("action.devices.traits.OnOff")
    }
    if (this.EXT["EXT-Volume"]) {
      if (!this.device.attributes) this.device.attributes = {}
      this.device.traits.push("action.devices.traits.Volume")
      this.device.attributes.volumeMaxLevel = 100
      this.device.attributes.volumeCanMuteAndUnmute = true
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
    if (this.EXT["EXT-Alert"]) {
      this.device.traits.push("action.devices.traits.Locator")
    }
    if (this.EXT["EXT-Spotify"]) {
      this.device.traits.push("action.devices.traits.AppSelector")
      if (!this.device.attributes) this.device.attributes = {}
      this.device.attributes.availableApplications = []
      let spotify = {
        "key": "spotify",
        "names": [
          {
            "name_synonym": [
              "spotify"
            ],
            "lang": "fr" // <-- change to language
          }
        ]
      }
      this.device.attributes.availableApplications.push(spotify)
      this.device.traits.push("action.devices.traits.TransportControl")
      this.device.attributes.transportControlSupportedCommands = [
        "NEXT",
        "PAUSE",
        "PREVIOUS",
        "RESUME",
        "STOP"
      ]
    }
    log("Your device is now", this.device)
  }

  refreshData(data) {
    this.oldSmartHome = {
      Screen: this.SmartHome.Screen,
      Volume: this.SmartHome.Volume,
      VolumeIsMuted: this.SmartHome.VolumeIsMuted,
      Page: this.SmartHome.Page,
      MaxPages: this.SmartHome.MaxPages,
      SpotifyIsConnected: this.SmartHome.SpotifyIsConnected,
      SpotifyIsRemote: this.SmartHome.SpotifyIsRemote,
      SpotifyIsPlaying: this.SmartHome.SpotifyIsPlaying
    }
    this.SmartHome.Screen = data["EXT-Screen"].power
    this.SmartHome.Volume = data["EXT-Volume"].speaker
    this.SmartHome.VolumeIsMuted = data["EXT-Volume"].isMuted
    this.SmartHome.Page = data["EXT-Pages"].actual
    this.SmartHome.MaxPages = data["EXT-Pages"].total
    this.SmartHome.SpotifyIsConnected = data["EXT-Spotify"].connected
    this.SmartHome.SpotifyIsRemote = data["EXT-Spotify"].remote
    this.SmartHome.SpotifyIsPlaying = data["EXT-Spotify"].play
  }

  getCurrentSmarthome() {
    return this.SmartHome
  }
  
  getOldSmartHome() {
    return this.oldSmartHome
  }
  
  getEXT() {
    return this.EXT
  }
}

module.exports = SMARTHOME
