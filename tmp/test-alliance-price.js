const AllianceDepot = require('../src/depots/alliance.js');
const fs = require('fs');
const path = require('path');

async function test() {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf-8'));
    const depotConf = config.depots['alliance'];
    const creds = depotConf ? depotConf.credentials : null;
    
    if (!creds || !creds.kullaniciAdi || !creds.sifre) {
        console.error("Credentials missing in config.json");
        return;
    }

    const depot = new AllianceDepot(creds);
    console.log("Logging in...");
    const loginRes = await depot.login();
    if (!loginRes.success) {
        console.error("Login failed:", loginRes.error);
        return;
    }
    console.log("Login success. Token:", depot.token);

    console.log("Searching for MAJEZIK...");
    const searchRes = await depot.search("MAJEZIK 100 MG 15 TB");
    
    if (searchRes.error) {
        console.error("Search failed:", searchRes.error);
        return;
    }

    const maezik = searchRes.results.find(r => r.ad.includes("MAJEZIK 100 MG 15 TB") || r.kodu === "8699536090115");
    
    if (!maezik) {
        console.error("MAJEZIK not found in results. Results count:", searchRes.results.length);
        if (searchRes.results.length > 0) {
            console.log("First result:", searchRes.results[0].ad);
        }
        return;
    }

    console.log("Found Majezik:", maezik.ad, "Price:", maezik.fiyat);
    console.log("Calculating net price...");
    
    // The calculatePrice is already called inside search() because I updated search() to call _fetchPricesAndReturn
    // Let's check if the price changed.
    
    console.log("Final Price from search():", maezik.fiyat);

    if (maezik.fiyat === "136,55" || maezik.fiyat === "136,54") {
        console.error("FAIL: Price is still list price (136,55)");
    } else if (maezik.fiyat === "124,76") {
        console.log("SUCCESS: Price is correct (124,76)");
    } else {
        console.log("Price is:", maezik.fiyat, " (Mismatch with 124,76)");
    }
}

test();
