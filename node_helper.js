/**************************
*  EXT-SmartHome v1.0     *
*  Bugsounet              *
*  12/2022                *
***************************/
"use strict"

var log = () => { /* do nothing */ }
const smarthome = require("./components/server.js")

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function() {
    this.server= null
    this.first = true
    this._callbacks = {
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
      },
      setPage: (number) => {
        log("setInput", number)
        this.sendSocketNotification("SET-PAGE", number)
      },
      setNextPage: () => {
        log("setNextPage")
        this.sendSocketNotification("SET-NEXT-PAGE")
      },
      setPreviousPage: () => {
        log("setPreviousPage")
        this.sendSocketNotification("SET-PREVIOUS-PAGE")
      },
      Alert: (alert) => {
        this.sendSocketNotification("ALERT", alert)
      },
      Reboot: () => {
        this.sendSocketNotification("REBOOT")
      }
    }
  },

  initialize: function(payload) {
    console.log("[SMARTHOME] EXT-SmartHome Version:", require('./package.json').version, "rev:", require('./package.json').rev)
    this.config = payload
    if (payload.debug) {
      log = (...args) => { console.log("[SMARTHOME]", ...args) }
    }
    this.server = new smarthome(this.config, this._callbacks)
  },

  socketNotificationReceived: function(noti, payload) {
    switch (noti) {
      case "INIT":
        this.initialize(payload)
        break
      case "GATEWAYDB":
        if (this.first) {
          this.server.set(payload)
          this.first = false
          this.server.start()
        } else {
          this.server.refreshDB(payload)
        }
        break
    }
  }
})
