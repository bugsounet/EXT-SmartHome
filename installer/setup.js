var prompt = require("prompt");
var colors = require("@colors/colors/safe");
const isValidDomain = require('is-valid-domain');
const fs = require("fs");

async function main() {
  prompt.message = "[EXT-SMartHome]";
  prompt.delimiter = colors.green("~")

  prompt.start();

  prompt.get({
    properties: {
      domain: {
        description: colors.yellow("What is your domain name?")
      }
    }
  }, function (err, result) {
    if (err) {
      console.log(err)
      process.exit(255)
    }
    if (!result.domain || !isValidDomain(result.domain)) {
      console.error("[EXT-SMartHome] " + colors.red("Error: domaine name must be a valid!"))
      process.exit(255)
    }
    saveDomain(result.domain)
  })
}

function saveDomain(domain) {
  console.log("[EXT-SmartHome] " + colors.cyan("Writing your domain name..."))
  fs.writeFile(__dirname+"/DomainName", domain, (err, data) => {
    if (err) {
      console.error("[EXT-SMartHome] " + colors.red("Error:" + err.message))
      return process.exit(255)
    }
    console.log("[EXT-SmartHome] " + colors.cyan("OK\n"))
  })
}

main()
