// Module on/off for MagicMirror²
// @bugsounet

export const query = (data) => {
  let Result = false
  console.log("query data:", data)
  if (data["Screen"] == "ON") {
    Result = true
  }
  return {"on": Result, "online": true, "volumeLevel": data.Volume}
};

export const action = (data, command, params, callback) => {
  if (command == "action.devices.commands.OnOff") {
    if (params['on']) callback.screen("ON")
    else callback.screen("OFF")

    return {"status": "SUCCESS", "states": {"on": params['on'], "online": true, "volumeLevel": 11}}
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
};
