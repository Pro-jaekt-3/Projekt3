# Rute

TanStack Start uporablja **file-based routing**. Vsaka datoteka `.tsx` v tej mapi
predstavlja ruto. Ne ustvarjaj `src/pages/`, `src/routes/_app/index.tsx` ali
`app/layout.tsx`, ker so to konvencije iz Next.js / Remix. Edini korenski layout
je `src/routes/__root.tsx`.

## Konvencije

| Datoteka                | URL                                                        |
| ----------------------- | ---------------------------------------------------------- |
| `index.tsx`             | `/`                                                        |
| `about.tsx`             | `/about`                                                   |
| `users/index.tsx`       | `/users`                                                   |
| `users/$id.tsx`         | `/users/:id` (dinamično — goli `$`, brez zavitih oklepajev) |
| `posts/{-$category}.tsx`| `/posts/:category?` (neobvezen segment)                    |
| `files/$.tsx`           | `/files/*` (splat — bere se prek parametra `_splat`, nikoli `*`) |
| `_layout.tsx`           | layout ruta (otroke izriše prek `<Outlet />`)              |
| `__root.tsx`            | app shell — ovije vsako stran; ohrani `<Outlet />`         |

`routeTree.gen.ts` se generira samodejno. Ne urejaj ga ročno.
