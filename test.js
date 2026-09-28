const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// We need to mock the DOM
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <select id="project"><option value="Zomra" selected>Zomra</option></select>
    <input id="base-price" value="1000000" />
    <input id="contract-date" value="2024-10-01" />
    <input id="duration-years" value="10" />
    <select id="payment-frequency"><option value="4" selected>Quarterly</option></select>
    <input id="flexible-toggle" value="yes" />
    <input id="custom-first-date" value="" />
    <input id="merge-delivery-toggle" type="checkbox" checked />
    
    <!-- All the custom inputs -->
    <div id="custom-inputs"></div>
    <input id="target-price-val" value="" />
    <input id="target-pct-val" value="" />
    <input id="fixed-inst-toggle" type="checkbox" />
    <input id="fixed-inst-val" value="" />
    <input id="base-inst-count" value="" />
    <input id="custom-inst-count" value="" />
    
    <div id="solver-options-panel" style="display:none;"></div>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.Date = dom.window.Date;

// mock appendChild, etc if needed
try {
    eval(code);
    
    // Set some defaults
    document.getElementById('custom-inputs').innerHTML = `
        <input id="dp1-val" value="" />
        <input id="dp1-type" value="pct" />
        <input id="dp2-val" value="" />
        <input id="dp2-type" value="pct" />
        <input id="addl-val" value="" />
        <input id="addl-type" value="pct" />
        <input id="deliv-val" value="" />
        <input id="deliv-type" value="pct" />
        <input id="annual-val" value="" />
        <input id="annual-type" value="pct" />
        <input id="toggle-70-30" type="checkbox" />
    `;
    
    // Call calculate
    calculate();
    
    console.log("Best Price:", bestPrice);
    console.log("Percentage:", ((bestPrice - 1000000) / 1000000) * 100);
} catch (e) {
    console.log(e);
}
