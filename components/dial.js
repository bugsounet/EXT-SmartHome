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
      result.isMuted = data.isMuted
    }
    if (EXT["EXT-Pages"]) {
      result.currentInput = "page " + data.Page
    }
    log("[QUERY] Result:", result)
    return result
  }

  execute(data, command, params, callback) { // to recode with switch
    switch (command) {
      case "action.devices.commands.OnOff":
        if (params['on']) callback.screen("ON")
        else callback.screen("OFF")
        return {"status": "SUCCESS", "states": {"on": params['on'], "online": true}}
        break
      case "action.devices.commands.volumeRelative":
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
        return {"status": "SUCCESS", "states": {"online": true, "currentVolume": level, "isMuted": data.isMuted}}
        break
      case "action.devices.commands.setVolume":
        callback.volume(params.volumeLevel)
        return {"status": "SUCCESS", "states": {"online": true, "currentVolume": params.volumeLevel, "isMuted": data.isMuted}}
        break
      case "action.devices.commands.mute":
        callback.volume(params.mute == true ? "mute" : "unmute")
        return {"status": "SUCCESS", "states": { "online": true, "isMuted": params.mute, "currentVolume": data.Volume}}
        break
      case "action.devices.commands.SetInput":
        log("SetInput", params)
        let input = params.newInput.split(" ")
        callback.setPage(input[1])
        return {"status": "SUCCESS", "states": { "online": true , "currentInput": params.newInput}}
        break
      case "action.devices.commands.NextInput":
        log("NextInput", params)
        callback.setNextPage()
        return {"status": "SUCCESS", "states": { "online": true }}
        break
      case "action.devices.commands.PreviousInput":
        log("PreviousInput", params)
        callback.setPreviousPage()
        return {"status": "SUCCESS", "states": { "online": true }}
        break
      case "action.devices.commands.Reboot":
        callback.Reboot()
        return {}
        break
      case "action.devices.commands.Locate":
        callback.Locate()
        return {"status": "SUCCESS"}
        break
      default:
        return {"status": "ERROR"}
        break
    }
  }

}
module.exports = DIAL  
