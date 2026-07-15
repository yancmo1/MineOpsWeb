# Branching and deployment policy

`dev` is the active development branch and the only branch used for local feature work. It does not deploy to Oracle. `main` is reserved for reviewed, production-ready changes; a future GitHub Actions workflow will run production checks, build immutable production images, take a pre-deployment backup, and deploy to Oracle only for pushes to `main`.

No automated deployment workflow is enabled yet. Do not merge to `main` merely to test development work.
