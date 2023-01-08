"use strict"

var log = () => { /* do nothing */ }
const {google} = require('googleapis')
const {GoogleAuth} = require('google-auth-library')
const path = require("path")
const fs = require("fs")
var _ = require('lodash')

class HOMEGRAPH {
  constructor (config, callback) {
    this.config = config
    this.callback = callback
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME] [HOMEGRAPH]", ...args) }
    this.init = false
    let file = path.resolve(__dirname, "../credentials.json")
    if (fs.existsSync(file)) {
      this.homegraph = google.homegraph({
        version: 'v1',
        auth: new GoogleAuth({
          keyFile: file,
          scopes: ['https://www.googleapis.com/auth/homegraph']
        })
      })
      this.init = true
    } else {
      this.callback.Alert("Hey! credentials.json: file not found!")
    }
  }

  /** HomeGraph dial **/
  async requestSync() {
    if (!this.init) return
    log("[RequestSync] in Progress...")
    let body = {
      requestBody: {
        agentUserId: "MagicMirror",
        async: false
      }
    }
    try {
      const res = await this.homegraph.devices.requestSync(body)
      log("[RequestSync] Done.", res.data, res.status, res.statusText)
    } catch (e) {
      if (e.code) {
        console.error("[SMARTHOME] [HOMEGRAPH] [RequestSync] Error:", e.code , e.errors)
        this.callback.Alert("[requestSync] Error " + e.code + " - " + e.errors[0].message +" ("+ e.errors[0].reason +")")
      } else {
        console.error("[SMARTHOME] [HOMEGRAPH] [RequestSync]", e.toString()) 
        this.callback.Alert("[requestSync] " + e.toString())
      }
    }
  }

  async queryGraph() {
    if (!this.init) return
    let query = {
      requestBody: {
        requestId: "bugsounetGA-"+Date.now(),
        agentUserId: "MagicMirror",
        inputs: [
          {
            payload: {
              devices: [
                {
                  id: "MMM-GoogleAssistant"
                }
              ]
            }
          }
        ]
      }
    }
    try { 
      const res = await this.homegraph.devices.query(query)
      log("[QueryGraph]", JSON.stringify(res.data))
    } catch (e) { 
      console.log("[SMARTHOME] [HOMEGRAPH] [QueryGraph]", e.code ? e.code : e, e.errors? e.errors : "")
    }
  }

  async updateGraph(EXT, current, old) {
    if (!this.init) return
    if (!_.isEqual(current, old)) {
      let state = {
        online: true
      }
      if (EXT["EXT-Screen"]) {
        state.on = current.Screen
      }
      if (EXT["EXT-Volume"]) {
        state.currentVolume = current.Volume
        state.isMuted = current.VolumeIsMuted
      }
      if (EXT["EXT-Pages"]) {
        state.currentInput = "page " + current.Page
      }
      if (EXT["EXT-Spotify"]) {
        state.currentApplication = current.SpotifyIsConnected ? "spotify" : "home"
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
      try {  
        const res = await this.homegraph.devices.reportStateAndNotification(body)
        if (res.status != 200) log("[ReportState]", res.data, state, res.status, res.statusText)
      } catch (e) {
        console.log("[SMARTHOME] [HOMEGRAPH] [ReportState]", e.code ? e.code : e, e.errors? e.errors : "")
      }
    }
  }
}

module.exports = HOMEGRAPH
