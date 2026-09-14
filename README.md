# ZYRA Federation

Independent country-data research project for the XUNIA / ZYRA ecosystem.

Website: https://xunia.org

## Current status

This repository starts with a tested UNdata SDMX transport connector. It is **not a completed clone**, a deployed website, or a populated Factbook archive. The incomplete local UI prototype has not been published: its sample values are not verified, its styling is missing, and it must not be presented as a working research product.

## UNdata

Official service directory: https://data.un.org/ws

REST base: https://data.un.org/ws/rest/

`connectors/undata.mjs` supports raw SDMX XML requests for dataflows, data structures, code lists, and observations. It returns source URL and retrieval time alongside the raw response. These are transport capabilities, not a normalized country-data API. Dataset identifiers, dimension order, observation periods, licensing and source-specific attribution must be inspected before using a dataset.

The external endpoint returned HTTP 500 during the initial connectivity check on 2026-09-14. Live integration is therefore **unverified**. Offline tests do not imply that UNdata is available. There is no mock-data fallback. XML parsing and catalog discovery remain to be implemented; any future XML parser must disable external entities.

Node.js 22 or newer; no dependencies required:

```sh
node --test tests/undata.test.mjs
```

Server-side usage:

```js
import { fetchSdmx } from './connectors/undata.mjs';
const catalog = await fetchSdmx('dataflow', ['all', 'all', 'latest'], { references: 'none' });
console.log(catalog.sourceUrl, catalog.retrievedAt, catalog.xml);
```

Run on a trusted server or CLI, not as an unrestricted public proxy. Network calls time out after 20 seconds, reject redirects and cap responses at 5 MiB. Large datasets must be queried in smaller slices.

## Remaining website work

- Inspect reference pages and document feature coverage.
- Import licensed/public-domain Factbook records with provenance and edition dates.
- Implement accessible country browsing, full-text search and real year-specific views.
- Implement comparisons, rankings and exports against validated observations.
- Add UNdata discovery, XML parsing, caching and availability status.
- Complete styling, responsive browser tests and deployment.

No affiliation or endorsement by the CIA, United Nations, or World Bank is claimed. The reference application's proprietary source code is not included. Operational weapon-targeting, missile guidance and mass-surveillance functionality are outside this implementation.
