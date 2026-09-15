# MineOps catalog

MineOps combines a release-scoped game catalog with a current manager reference database so the personal guide stays useful across package gaps and version changes.

## Language

**Manager reference database**:
The joined `sm-data` and `sm-actives` snapshot for current manager identities, display names, presentation details, and fallback active tables.
_Avoid_: fallback map, upstream override

**Catalog package**:
An immutable, release-scoped package of APK-derived game data whose exact rows are preferred whenever they are available.
_Avoid_: database, live catalog

**Player database**:
The local, user-specific progress, inventory, credentials, and sync metadata stored independently from catalog releases.
_Avoid_: catalog, save database
