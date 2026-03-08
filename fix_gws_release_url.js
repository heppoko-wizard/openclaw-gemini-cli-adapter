const fs = require('fs');
let code = fs.readFileSync('interactive-setup.js', 'utf8');

// The googleworkspace/cli release isn't simply "steipete/gws"
code = code.replace(/path: '\/repos\/steipete\/gws\/releases\/latest'/g, "path: '/repos/googleworkspace/cli/releases/latest'");

fs.writeFileSync('interactive-setup.js', code, 'utf8');
console.log("Fixed release URL");
