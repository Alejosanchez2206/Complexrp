module.exports = {
    apps : [{
      name   : "Brutal Arena",
      script : "./index.js",
      max_memory_restart: "4G",  // Reinicia si supera 4 GB
      node_args: "-max-old-space-size=4096"  // Límite de memoria de 4 GB
    }]
  }