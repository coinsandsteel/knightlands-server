module.exports = {
  apps: [{
    name: "knightlands",
    script: "./src/server.js",
    watch: true,
    node_args: "-r esm -r ts-node/register"
  }]
}