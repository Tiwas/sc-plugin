# SickChill Plugin

En nettleserutvidelse som gjør det enklere å legge til TV-serier i din lokale SickChill-installasjon.

![SickChill Plugin in action on IMDb](https://tiwas.github.io/sc-plugin/img/IMDb%20injected%20link.png)

---

## Om prosjektet

Dette er en "hjelper"-utvidelse designet for å effektivisere prosessen med å legge til nye serier i SickChill. Utvidelsen identifiserer TV-serier på støttede nettsider (som f.eks. IMDb) og injiserer et lite SickChill-ikon ved siden av tittelen. Et klikk på dette ikonet tar deg direkte til "Legg til serie"-siden i din SickChill, med serienavnet allerede fylt ut i søkefeltet.

Besøk prosjektets [hjemmeside](https://tiwas.github.io/sc-plugin/) for en mer detaljert oversikt.

### Nøkkelfunksjoner
* **Hurtiglenke:** Injisierer en 'Legg til i SickChill'-lenke på seriesider.
* **Automatisert søk:** Åpner 'Legg til serie'-siden i SickChill og starter søket automatisk.
* **Fleksibelt oppsett:** Støtter egendefinerte regler for hvilke sider som skal gjenkjennes, via innstillingssiden.
* **Datahåndtering:** Inkluderer funksjonalitet for backup og gjenoppretting av innstillingene dine.

## Forutsetninger

For at denne utvidelsen skal fungere, må du ha en fungerende installasjon av [SickChill](https://sickchill.github.io/).

## Installasjon

### Fra Chrome Web Store (Anbefalt)
*Kommer snart!*

### Manuell Installasjon (for utviklere)
1.  Klon eller last ned dette repositoryet.
2.  Åpne Chrome og gå til `chrome://extensions`.
3.  Aktiver "Developer mode" (Utviklermodus) øverst til høyre.
4.  Klikk på "Load unpacked" (Last inn upakket).
5.  Naviger til og velg **`./plugin`**-mappen fra dette repositoryet.

## Kom i gang: Konfigurering

Etter installasjon må du konfigurere utvidelsen for å koble den til din SickChill-installasjon.

1.  **Åpne innstillinger:** Høyreklikk på utvidelsesikonet i nettleseren og velg "Options".
2.  **Generelle innstillinger:** Fyll inn din SickChill URL (intern/ekstern) og din API-nøkkel.
3.  **Konfigurer sider:** For å komme raskt i gang, kan du laste ned en ferdigkonfigurert innstillingsfil for IMDb:
    * Last ned [**getting_started.json**](https://tiwas.github.io/sc-plugin/getting_started.json).
    * På innstillingssiden, gå til "Data Management", klikk "Restore Settings", og velg filen du nettopp lastet ned. **OBS:** Dette vil overskrive dine nåværende innstillinger.

## Prosjektstruktur

**Viktig:** Kildekoden for selve nettleserutvidelsen ligger i mappen [`./plugin`](./plugin). Resten av filene i roten av repositoryet (som `index.html`, bilder, etc.) tilhører prosjektets hjemmeside.

## Støtte og Tilbakemeldinger

Tilbakemeldinger og forslag til forbedringer er alltid velkomne!

Hvis du finner denne utvidelsen nyttig, kan du vurdere å støtte utviklingen med en liten donasjon.

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](http://paypal.me/tiwasno/1EUR)

## Bidrag

Rapporter feil eller kom med forslag under ['Issues'](https://github.com/Tiwas/sc-plugin/issues)-fanen i dette repositoryet. Pull requests er også velkomne.

## Ansvarsfraskrivelse

Ikonet og navnet "SickChill" er lånt fra det offisielle SickChill-prosjektet og tilhører deres respektive eiere. Denne utvidelsen er et uavhengig og uoffisielt prosjekt.