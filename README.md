This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Implemented

- Upload chunks instead of upload the whole file.
- Upload by stream.
- If file has been uploaded, do not need to upload again.
- Restore the progress.
- Stop and continue the progress.
- Upload multiple files.
- Chunks hash cache in client.
- Delete chunks after uploaded in server.

## TODO

- Hash validation in merging.
- hash validation in chunk.
- Consider upload a same file in same time in deferent endpoint.
- Concurrency number should be determined by the performance of server and browser.

## Record of problems

### client.destroy()

In the old version of `Client` model, `start()` method is asynchronous and there is a promise chain inside it. When I call `destroy()` method I want to stop the chain which may be running at that time, I need to create a condition determining
that current state is destroyed or not for each micro task. Because if `client` has been destroyed, it should not go to next chain. So the code becomes bad.

Finally I found a solution using `RxJS`, I turn the promise chain to stream with `operators`, create a `subscription` property which store all subscriptions, call the `subscription.unsubscribe()` inside the `destroy()`. So when call `destroy()`, all the subscriptions would be unsubscribed and the stream will be stopped.
