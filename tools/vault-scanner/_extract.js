var fs = require('fs');
var src = fs.readFileSync('index.js', 'utf8');
var uiStart = src.indexOf('const UI_HTML = `');
var uiEnd = src.lastIndexOf('`;');
var templateContent = src.slice(uiStart + 'const UI_HTML = `'.length, uiEnd);
var scriptTagPos = templateContent.indexOf('<script>');
var scriptEndPos = templateContent.indexOf('</script>', scriptTagPos);
var scriptSrc = templateContent.slice(scriptTagPos + 8, scriptEndPos);
// In index.js source, \\ is a literal backslash escape in the template literal
// So the browser receives: each \\ in source becomes \ in rendered HTML
var ch = String.fromCharCode(92); // backslash
var scriptRendered = scriptSrc.split(ch + ch).join(ch);
fs.writeFileSync('_check_script.js', scriptRendered);
console.log('Written', scriptRendered.length, 'chars,', scriptRendered.split('\n').length, 'lines');
