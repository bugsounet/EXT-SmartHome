/**************************
*  EXT-SmartHome v1.0     *
*  Bugsounet              *
*  12/2022                *
***************************/
"use strict"

var log = () => { /* do nothing */ }
const server = require("./components/server.js")

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function() {
    this.server= null
    this.first = true
    this._callbacks = {
      screen: (state) => {
        log("Send screen:", state)
        this.sendSocketNotification("SCREEN", state)
      },
      volume: (level) => {
        log("Send volume", level)
        this.sendSocketNotification("VOLUME", level)
      },
      volumeUp: () => {
        log("Send volume Up")
        this.sendSocketNotification("VOLUME-UP")
      },
      volumeDown: () => {
        log("Send volume Down")
        this.sendSocketNotification("VOLUME-DOWN")
      },
      setPage: (number) => {
        log("Send setInput", number)
        this.sendSocketNotification("SET-PAGE", number)
      },
      setNextPage: () => {
        log("Send setNextPage")
        this.sendSocketNotification("SET-NEXT-PAGE")
      },
      setPreviousPage: () => {
        log("Send setPreviousPage")
        this.sendSocketNotification("SET-PREVIOUS-PAGE")
      },
      Alert: (alert) => {
        log("Send Alert", alert)
        this.sendSocketNotification("ALERT", alert)
      },
      Reboot: () => {
        log("Send Reboot")
        this.sendSocketNotification("REBOOT")
      },
      Locate: () => {
        log("Send Locate")
        this.sendSocketNotification("LOCATE")
      }
    }
  },

  initialize: function(payload) {
    console.log("[SMARTHOME] EXT-SmartHome Version:", require('./package.json').version, "rev:", require('./package.json').rev)
    this.config = payload
    if (payload.debug) {
      log = (...args) => { console.log("[SMARTHOME] [CORE]", ...args) }
    }
    this.server = new server(this.config, this._callbacks)
  },

  socketNotificationReceived: function(noti, payload) {
    switch (noti) {
      case "INIT":
        this.initialize(payload)
        break
      case "GATEWAYDB":
        if (!this.server) return
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
