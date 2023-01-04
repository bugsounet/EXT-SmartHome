"use strict"

var log = () => { /* do nothing */ }

class DIAL {
  constructor(config) {
    this.config = config
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME] [DIAL]", ...args) }
    log("Loaded!")
  }

  query(data, EXT) {
    let result = { "online": true }
    if (EXT["EXT-Screen"]) {
      result.on = (data["Screen"] == "ON") ? true : false
    }
    if (EXT["EXT-Volume"]) {
      result.currentVolume = data.Volume
    }
    if (EXT["EXT-Pages"]) {
      result.currentInput = "page " + data.Page
    }
    log("[QUERY] Result:", result)
    return result
  }

  execute(data, command, params, callback) { // to recode with switch
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
      return {"status": "SUCCESS", "states": {"online": true, "currentVolume": level}}
    } else if (command == "action.devices.commands.setVolume") {
      callback.volume(params.volumeLevel)
      return {"status": "SUCCESS", "states": {"online": true, "currentVolume": params.volumeLevel}}
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
    } else if (command == "action.devices.commands.Reboot") {
      callback.Reboot()
      return {}
    } else if (command == "action.devices.commands.Locate") {
      callback.Locate()
      return {"status": "SUCCESS"}
    } else {
      return {"status": "ERROR"}
    }
  }

}
module.exports = DIAL  
