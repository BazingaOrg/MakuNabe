const fs = require('fs')

fs.copyFileSync('./dist/index.html', './dist/sidepanel.html')

const manifest = require('./dist/manifest.json')
manifest.web_accessible_resources.forEach(resource => {
  resource.use_dynamic_url = false
})
fs.writeFileSync('./dist/manifest.json', JSON.stringify(manifest, null, 2))
