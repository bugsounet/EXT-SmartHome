"use strict";

//
//const util = require("node:util");
//const { exec, spawn } = require("node:child_process");
//const http = require("node:http");
//const express = require("express");
//const session = require("express-session");
//const bodyParser = require("body-parser");
//const cors = require("cors");

const fs = require("node:fs");
const GoogleAuthLibrary = require("google-auth-library");

var log = (...args) => { /* do nothing */ };

class smarthome {
  constructor (config, cb = () => {}) {
    this.config = config;
    console.log(this.config)
    this.sendSocketNotification = (...args) => cb.sendSocketNotification(...args);

    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME]", ...args); };

    this.smarthome = {
      user: { username: "admin", password: "admin" },
      use: false
    };
    this.root_path = global.root_path;
    this.SmartHomeModulePath = `${this.root_path}/modules/EXT-SmartHome`;
  }

  async init () {
    console.log("[SMARTHOME] Loading SmartHome...");
    if (!this.config.username && !this.config.password) {
      console.error("[SMARTHOME] Your have not defined user/password in config!");
      console.error("[SMARTHOME] Using default credentials");
    } else {
      if ((this.config.username === this.smarthome.user.username) || (this.config.password === this.smarthome.user.password)) {
        console.warn("[SMARTHOME] WARN: You are using default username or default password");
        console.warn("[SMARTHOME] WARN: Don't forget to change it!");
      }
      this.smarthome.user.username = this.config.username;
      this.smarthome.user.password = this.config.password;
    }

    let file = `${this.SmartHomeModulePath}/smarthome.json`;
    fs.readFile(file, "utf8", (err, data) => {
      let content;
      if (!data) {
        console.error("[SMARTHOME] smarthome.json: file not found!");
        this.send("Alert", "smarthome.json: file not found!");
        return;
      }

      try {
        content = JSON.parse(data);
      } catch (e) {
        console.error("[SMARTHOME] smarthome.json: corrupt!");
        this.send("Alert", "smarthome.json: corrupt!");
        return;
      }
      if (content.type && content.type === "service_account") {
        this.SmartHome.homegraph = googleapis.google.homegraph({
          version: "v1",
          auth: new GoogleAuthLibrary.GoogleAuth({
            keyFile: file,
            scopes: ["https://www.googleapis.com/auth/homegraph"]
          })
        });
      } else {
        console.error("[SMARTHOME] smarthome.json: bad format!");
        this.send("Alert", "smarthome.json: bad format!");
      }
    });
  }

  /** callbacks **/

  send (name, values) {
    switch (name) {
      case "screen":
        log("[CALLBACK] Send screen:", values);
        this.sendSocketNotification("CB_SCREEN", values);
        break;
      case "volume":
        log("[CALLBACK] Send volume:", values);
        this.sendSocketNotification("CB_VOLUME", values);
        break;
      case "volumeMute":
        log("[CALLBACK] Send volume Mute:", values);
        this.sendSocketNotification("CB_VOLUME-MUTE", values);
        break;
      case "volumeUp":
        log("[CALLBACK] Send volume Up");
        this.sendSocketNotification("CB_VOLUME-UP");
        break;
      case "volumeDown":
        log("[CALLBACK] Send volume Down");
        this.sendSocketNotification("CB_VOLUME-DOWN");
        break;
      case "setPage":
        log("[CALLBACK] Send setInput:", values);
        this.sendSocketNotification("CB_SET-PAGE", values);
        break;
      case "setNextPage":
        log("[CALLBACK] Send setNextPage");
        this.sendSocketNotification("CB_SET-NEXT-PAGE");
        break;
      case "setPreviousPage":
        log("[CALLBACK] Send setPreviousPage");
        this.sendSocketNotification("CB_SET-PREVIOUS-PAGE");
        break;
      case "Alert":
        log("[CALLBACK] Send Alert:", values);
        this.sendSocketNotification("CB_ALERT", values);
        break;
      case "Done":
        log("[CALLBACK] Send Alert Done:", values);
        this.sendSocketNotification("CB_DONE", values);
        break;
      case "Reboot":
        log("[CALLBACK] Send Reboot");
        setTimeout(() => this.restart(), 8000);
        break;
      case "Locate":
        log("[CALLBACK] Send Locate");
        this.sendSocketNotification("CB_LOCATE");
        break;
      case "SpotifyPlay":
        log("[CALLBACK] Send SpotifyPlay");
        this.sendSocketNotification("CB_SPOTIFY-PLAY");
        break;
      case "SpotifyPause":
        log("[CALLBACK] Send SpotifyPause");
        this.sendSocketNotification("CB_SPOTIFY-PAUSE");
        break;
      case "SpotifyPrevious":
        log("[CALLBACK] Send SpotifyPrevious");
        this.sendSocketNotification("CB_SPOTIFY-PREVIOUS");
        break;
      case "SpotifyNext":
        log("[CALLBACK] Send SpotifyNext");
        this.sendSocketNotification("CB_SPOTIFY-NEXT");
        break;
      case "Stop":
        log("[CALLBACK] Send Stop");
        this.sendSocketNotification("CB_STOP");
        break;
      case "TVPlay":
        log("[CALLBACK] Send TVPlay");
        this.sendSocketNotification("CB_TV-PLAY");
        break;
      case "TVNext":
        log("[CALLBACK] Send TVNext");
        this.sendSocketNotification("CB_TV-NEXT");
        break;
      case "TVPrevious":
        log("[CALLBACK] Send TVPrevious");
        this.sendSocketNotification("CB_TV-PREVIOUS");
        break;
      case "SpotifyLyricsOn":
        log("[CALLBACK] Send Lyrics on");
        this.sendSocketNotification("CB_SPOTIFY-LYRICS-ON");
        break;
      case "SpotifyLyricsOff":
        log("[CALLBACK] Send Lyrics off");
        this.sendSocketNotification("CB_SPOTIFY-LYRICS-OFF");
        break;
      default:
        log("[CALLBACK] Unknow callback:", name);
        break;
    }
  }
}

module.exports = smarthome;
