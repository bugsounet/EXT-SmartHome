// Module on/off for MagicMirror²
// @bugsounet

export const query = (data) => {
  let Result = false
  if (data["Screen"] == "ON") {
    Result = true
  }
  return {"on": Result, "online": true}
};

export const action = (data, command, params, callback) => {
  if (command == "action.devices.commands.OnOff") {
    if (params['on']) callback("ON")
    else callback("OFF")
    return {"status": "SUCCESS", "states": {"on": params['on'], "online": true}}
  } else if (command == "action.devices.commands.volumeRelative") {
    console.log(params)
    return {"status": "SUCCESS"}
  } else {
    return {"status": "ERROR"}
  } 
};
