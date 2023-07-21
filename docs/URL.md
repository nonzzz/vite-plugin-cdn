# URL

`vite-plugin-cdn2` provide two preset source. `jsdelivr` and `unpkg`. you can using it like this way.

```js
import { cdn } from 'vite-plugin-cdn2'
import { unpkg } from 'vite-plugin-cdn2/url'

cdn({url:unpkg,modules:['vue']})

```

Then all of source will bind with unpkg.