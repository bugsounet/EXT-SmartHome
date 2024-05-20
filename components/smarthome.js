"use strict";

//const fs = require("node:fs");
//const util = require("node:util");
//const { exec, spawn } = require("node:child_process");
//const http = require("node:http");
//const express = require("express");
//const session = require("express-session");
//const bodyParser = require("body-parser");
//const cors = require("cors");

var log = (...args) => { /* do nothing */ };

class smarthome {
  constructor (config, cb = () => {}) {
    this.config = config.config;
    this.sendSocketNotification = (...args) => cb(...args);

    if (config.debug) log = (...args) => { console.log("[SMARTHOME]", ...args); };
    this.smarthome = {
    };
  }

  async init (data) {
    console.log("[SMARTHOME] Loading SmartHome...");

  }
}

module.exports = smarthome;
