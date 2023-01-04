"use strict"

var log = () => { /* do nothing */ }
const path = require("path")
const fs = require("fs")

class TOOLS {
  constructor(config) {
    this.config = config
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME] [TOOLS]", ...args) }
    this.tokensDir = path.resolve(__dirname + "/../tokens/")
    this.user = {
      "password": this.config.password,
      "devices": [
          "MMM-GoogleAssistant"
      ]
    }
    log("Loaded!")
  }

  get_user(username) {
    if (username == this.config.username) {
      return this.user
    } else {
      return null
    }
  }

  get_device(device_id, device) {
    if (device_id == "MMM-GoogleAssistant") {
      let data = device
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
      console.error("[SMARTHOME] [TOOLS] No token found in headers")
      return null
    }
    if (fs.existsSync(this.tokensDir + "/" + access_token)) {
      let user = fs.readFileSync(this.tokensDir + "/" +access_token, 'utf8')
      return user
    } else {
      console.error("[SMARTHOME] [TOOLS] Token not found in database", access_token)
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

  delete_token(access_token) {
    if (fs.existsSync(this.tokensDir + "/" + access_token)) {
      fs.unlinkSync(this.tokensDir + "/" + access_token)
      log("[TOKEN] Deleted:", access_token)
    } else {
      log("[TOKEN] Delete Failed", access_token)
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
module.exports = TOOLS 
