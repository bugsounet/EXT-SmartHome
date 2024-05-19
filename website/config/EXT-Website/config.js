var defaultConfig = {
  module: "EXT-Website",
  disabled: false,
  config: {
    debug: false,
    username: "admin",
    password: "admin",
    CLIENT_ID: null
  }
};

var schema = {
  title: "EXT-Website",
  description: "{PluginDescription}",
  type: "object",
  properties: {
    module: {
      type: "string",
      title: "{PluginName}",
      default: "EXT-Website"
    },
    disabled: {
      type: "boolean",
      title: "{PluginDisable}",
      default: false
    },
    config: {
      type: "object",
      title: "{PluginConfiguration}",
      properties: {
        debug: {
          type: "boolean",
          title: "{PluginDebug}",
          default: false
        },
        username: {
          type: "string",
          title: "{EXT-Website_username}",
          default: "admin"
        },
        password: {
          type: "string",
          title: "{EXT-Website_password}",
          default: "admin"
        },
        CLIENT_ID: {
          type: ["string", "null"],
          title: "{EXT-Website_CLIENTID}",
          default: null
        }
      },
      required: ["username","password"]
    }
  },
  required: ["module"]
};

exports.default = defaultConfig;
exports.schema = schema;
