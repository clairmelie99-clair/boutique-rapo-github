# BoutiqueRapo POS

BoutiqueRapo POS se yon aplikasyon HTML/PWA pou jere yon ti boutique: vann, stock, rapo, depans, det, commandes online, livrezon, admin, caissier, ak lisans pa aparey.

## Fichye prensipal

- `index.html` se vèsyon kliyan/piblik la.
- Pa mete vèsyon `DEV`, `MASTER-DEV`, oswa fichye ki gen jeneratè lisans sou yon repo piblik.

## Kouman pou teste

Ou ka ouvri `index.html` dirèkteman nan browser la.

PIN default app la:

```text
1234
```

Premye fwa ou antre ak PIN app/admin lan, ou gen aksè admin. Admin ka:

- ajoute, modifye, pause, revoke caissier;
- bay chak caissier PIN pa yo;
- jere pwodwi, stock, depans, det, commandes, livrezon;
- wè rapo pa caissier ak pa aparey;
- wè lis aparey ki aktive sou lisans lan.

Caissier ki antre ak PIN pa li gen aksè limite:

- vann;
- commande/livrezon si admin pèmèt sa;
- rapo pa li sèlman;
- resi.

Caissier pa gen aksè ak pwodwi, depans, det, admin, paramèt, backup, oswa lisans.

## Lisans

Vèsyon kliyan an kenbe:

- essai 7 jou;
- kòd aparey inik;
- kòd aktivasyon ki mare ak aparey la;
- plan pa kantite aparey.

Plan yo:

| Plan | Aparèy | Pri/mwa |
| --- | ---: | ---: |
| Solo | 1 | 250 HTG |
| Ti Ekip | 2-5 | 500 HTG |
| Boutique+ | 6-10 | 900 HTG |
| Business | 11-99 | 2,500 HTG |
| Enterprise | 100-999 | Sou demann |

## Vèsyon prive

Kenbe vèsyon sa yo prive:

- `boutique-rapo-v2-FINAL-3-DEV.html`
- `boutique-rapo-v2-FINAL-3-MASTER-DEV.html`
- nenpòt fichye ki gen `generateLicenseFromAdmin`
- nenpòt fichye ki gen `licenseSecret` prive ou vle pwoteje

## Rekòmandasyon GitHub

Pou GitHub Pages, mete `index.html` nan rasin repo a. Si repo a piblik, pa mete zouti devlopè yo ladan l.
