var fs = require('fs');
var src = fs.readFileSync('index.js', 'utf8');
var marker = 'const UI_HTML = `';
var uiStart = src.indexOf(marker) + marker.length;
var uiEnd = src.lastIndexOf('`;\n');
var content = src.slice(uiStart, uiEnd);
var lines = content.split('\n');
var found = 0;
for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  for (var j = 0; j < line.length; j++) {
    if (line.charCodeAt(j) === 96) { // backtick
      console.log('BACKTICK at HTML line ' + (i+1) + ' col ' + j + ': ' + line.slice(Math.max(0,j-40), j+40));
      found++;
    }
  }
}
if (found === 0) console.log('No bare backticks found inside UI_HTML template literal');
console.log('Total HTML lines:', lines.length);
