const text = await (await fetch(new URL('./app.b64.txt', import.meta.url))).text();
const bytes = Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0));
const src = new TextDecoder().decode(bytes);
await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
