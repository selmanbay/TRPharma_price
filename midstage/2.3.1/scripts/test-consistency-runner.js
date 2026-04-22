const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const V23_SCRIPTS = path.join(ROOT, 'renderer', 'scripts');
const V22_LEGACY_PRICING = path.resolve(ROOT, '..', '2.2', 'renderer', 'src', 'features', 'pricing', 'LegacyPricingEngine.js');

function getArg(flag, fallback = '') {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function createBrowserContext() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    navigator: { clipboard: { writeText: async () => {} } },
    document: {},
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function loadBrowserScript(context, filename) {
  const fullPath = path.join(V23_SCRIPTS, filename);
  const code = fs.readFileSync(fullPath, 'utf8');
  vm.runInContext(code, context, { filename: fullPath });
  return fullPath;
}

async function loadV22LegacyPricing() {
  const moduleUrl = `${pathToFileURL(V22_LEGACY_PRICING).href}?ts=${Date.now()}`;
  return import(moduleUrl);
}

function createHarness() {
  const context = createBrowserContext();
  loadBrowserScript(context, 'utils.js');
  loadBrowserScript(context, 'offer-domain.js');
  loadBrowserScript(context, 'search-domain.js');
  loadBrowserScript(context, 'operation-identity.js');
  loadBrowserScript(context, 'app-actions.js');
  return {
    context,
    parseMf: context.parseMf,
    parseQRCode: context.parseQRCode,
    isBarcodeQuery: context.isBarcodeQuery,
    normalizeDrugName: context.normalizeDrugName,
    V23OfferDomain: context.V23OfferDomain,
    V23SearchDomain: context.V23SearchDomain,
    V23OperationIdentity: context.V23OperationIdentity,
    V23AppActions: context.V23AppActions,
  };
}

function createCollector() {
  const checks = [];
  return {
    check(name, passed, details = {}) {
      checks.push({ name, passed: Boolean(passed), ...details });
    },
    summary(suite) {
      const passed = checks.filter((entry) => entry.passed).length;
      const failed = checks.length - passed;
      return {
        suite,
        ok: failed === 0,
        passed,
        failed,
        checks,
      };
    },
  };
}

function approxEqual(a, b, epsilon = 0.0001) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
}

function formatLine(result) {
  if (result.passed) return `  [PASS] ${result.name}`;
  const detail = result.reason ? ` - ${result.reason}` : '';
  return `  [FAIL] ${result.name}${detail}`;
}

async function runMfParitySuite() {
  const harness = createHarness();
  const legacy = await loadV22LegacyPricing();
  const collector = createCollector();
  const sampleItems = [
    {
      ad: 'PHARMATON 2.0 VITALITY 30 TB.',
      barkod: '8683060010220',
      depoKey: 'selcuk',
      depot: 'Selcuk Ecza',
      depotId: 'selcuk',
      fiyatNum: 600,
      malFazlasi: '10+1',
      mfStr: '10+1',
    },
    {
      ad: 'KREVAL FORTE 15MG 100ML SRP.',
      barkod: '8699559570069',
      depot: 'Nevzat Ecza',
      depotId: 'nevzat',
      fiyatNum: 112.08,
      malFazlasi: '10+1',
      mfStr: '10+1',
    },
  ];
  const quantities = [1, 2, 10, 11, 20];
  const shouldUseMfForQty = (qty) => Number.isInteger(qty) && qty > 1;

  sampleItems.forEach((item) => {
    quantities.forEach((qty) => {
      const v23 = harness.V23OfferDomain.calculatePlanning(item, qty, {
        parseMf: harness.parseMf,
        depotMeta: {
          [item.depotId]: { label: item.depot },
        },
      });
      const v22Option = legacy.getFallbackPlannerOptions([item], qty, {
        parseMf: harness.parseMf,
        shouldUseMfForQty,
      })[0];

      const same =
        Number(v23.orderQty) === Number(v22Option.orderQty)
        && Number(v23.receiveQty) === Number(v22Option.receiveQty)
        && approxEqual(v23.totalCost, v22Option.totalCost)
        && approxEqual(v23.effectiveUnit, v22Option.effectiveUnit);

      collector.check(
        `${item.barkod} qty=${qty} V2.2 parity`,
        same,
        same ? {} : {
          reason: `v23(order=${v23.orderQty}, receive=${v23.receiveQty}, total=${v23.totalCost}, unit=${v23.effectiveUnit}) != v22(order=${v22Option.orderQty}, receive=${v22Option.receiveQty}, total=${v22Option.totalCost}, unit=${v22Option.effectiveUnit})`,
        }
      );
    });
  });

  return collector.summary('mf-parity');
}

async function runBulkNormalizationSuite() {
  const harness = createHarness();
  const collector = createCollector();
  const raw = [
    '01086998201200302110051173830117260731102308005',
    '8699820120030',
    ' 8699820120030 ',
  ].join('\n');

  const normalized = harness.V23AppActions.normalizeBulkQueries(raw, {
    parseQRCode: harness.parseQRCode,
  });

  collector.check(
    'GS1 karekod + barkod tek satira iniyor',
    normalized.length === 1,
    normalized.length === 1 ? {} : { reason: `beklenen=1 gercek=${normalized.length}` }
  );
  collector.check(
    'Canonical barkod korunuyor',
    normalized[0]?.query === '8699820120030',
    normalized[0]?.query === '8699820120030' ? {} : { reason: `beklenen=8699820120030 gercek=${normalized[0]?.query || ''}` }
  );
  collector.check(
    'Tekrar okumalari adet olarak birlesiyor',
    Number(normalized[0]?.desiredQty) === 3,
    Number(normalized[0]?.desiredQty) === 3 ? {} : { reason: `beklenen=3 gercek=${normalized[0]?.desiredQty || 0}` }
  );
  collector.check(
    'Kaynak satirlar izlenebiliyor',
    Array.isArray(normalized[0]?.sourceQueries) && normalized[0].sourceQueries.length === 3,
    Array.isArray(normalized[0]?.sourceQueries) && normalized[0].sourceQueries.length === 3
      ? {}
      : { reason: `sourceQueries=${JSON.stringify(normalized[0]?.sourceQueries || [])}` }
  );

  return collector.summary('bulk-normalization');
}

async function runIdentityGroupingSuite() {
  const harness = createHarness();
  const collector = createCollector();
  const items = [
    {
      ad: 'CALPOL 6 PLUS 150 ML SUSP',
      barkod: '8699522705160',
      depot: 'Nevzat Ecza',
      depotId: 'nevzat',
      fiyatNum: 100,
      stok: 3,
    },
    {
      ad: 'CALPOL 6 PLUS 150 ML SUSP.',
      barkod: '8699522705160',
      depot: 'Selcuk Ecza',
      depotId: 'selcuk',
      fiyatNum: 98,
      stok: 1,
    },
    {
      ad: 'CALPOL 6 PLUS 250 MG 150 ML SUSP',
      barkod: '8699522705993',
      depot: 'Anadolu Pharma',
      depotId: 'anadolu-pharma',
      fiyatNum: 130,
      stok: 2,
    },
  ];

  const groups = harness.V23SearchDomain.buildVariantGroups(items, '8699522705160', {
    extractBarcode: harness.context.extractBarcode,
    parseQRCode: harness.parseQRCode,
    isBarcodeQuery: harness.isBarcodeQuery,
    normalizeDrugName: harness.normalizeDrugName,
  });

  collector.check(
    'Ayni barkod iki depoda tek varyant grubuna dusuyor',
    groups.length === 2,
    groups.length === 2 ? {} : { reason: `beklenen=2 gercek=${groups.length}` }
  );
  collector.check(
    'Ilk grup iki depot itemini iceriyor',
    Number(groups[0]?.items?.length || 0) === 2,
    Number(groups[0]?.items?.length || 0) === 2 ? {} : { reason: `ilk-grup-item=${groups[0]?.items?.length || 0}` }
  );
  const planKeys = harness.V23OperationIdentity.buildPlanKeyCandidates('BARCODE_8699522705160', '8699522705160', {
    isBarcodeQuery: harness.isBarcodeQuery,
  });
  collector.check(
    'Plan key adaylari barkod ve BARCODE_ formunu birlikte tutuyor',
    planKeys.has('8699522705160') && planKeys.has('BARCODE_8699522705160'),
    planKeys.has('8699522705160') && planKeys.has('BARCODE_8699522705160')
      ? {}
      : { reason: `adaylar=${JSON.stringify(Array.from(planKeys))}` }
  );

  return collector.summary('identity-grouping');
}

async function runSuite(name) {
  if (name === 'mf-parity') return runMfParitySuite();
  if (name === 'bulk-normalization') return runBulkNormalizationSuite();
  if (name === 'identity-grouping') return runIdentityGroupingSuite();
  if (name === 'all') {
    const suites = [];
    suites.push(await runMfParitySuite());
    suites.push(await runBulkNormalizationSuite());
    suites.push(await runIdentityGroupingSuite());
    const checks = suites.flatMap((suite) => suite.checks.map((entry) => ({ suite: suite.suite, ...entry })));
    const failed = checks.filter((entry) => !entry.passed).length;
    const passed = checks.length - failed;
    return {
      suite: 'all',
      ok: failed === 0,
      passed,
      failed,
      checks,
      suites,
    };
  }
  throw new Error(`Bilinmeyen suite: ${name}`);
}

async function main() {
  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const suite = positional[0] || 'all';
  const json = hasFlag('--json');
  const result = await runSuite(suite);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.suite === 'all') {
    console.log(`[${result.ok ? 'PASS' : 'FAIL'}] consistency/all`);
    console.log(`passed=${result.passed} failed=${result.failed}`);
    result.suites.forEach((suiteResult) => {
      console.log(`\n${suiteResult.suite}: ${suiteResult.ok ? 'PASS' : 'FAIL'}`);
      suiteResult.checks.forEach((entry) => {
        console.log(formatLine(entry));
      });
    });
  } else {
    console.log(`[${result.ok ? 'PASS' : 'FAIL'}] consistency/${result.suite}`);
    console.log(`passed=${result.passed} failed=${result.failed}`);
    result.checks.forEach((entry) => {
      console.log(formatLine(entry));
    });
  }

  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
