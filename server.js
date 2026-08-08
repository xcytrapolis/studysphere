const express = require("express");
const cheerio = require("cheerio");

const app = express();
const PORT = process.env.PORT || 10000;

const ALLOWED_HOSTS = new Set([
    "example.com",
    "www.example.com"
]);

app.use(express.static("public"));

function parseTarget(value) {
    try {
        const url = new URL(value);

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

function isAllowed(url) {
    return ALLOWED_HOSTS.has(url.hostname);
}

function proxiedUrl(url) {
    return "/proxy?url=" +
        encodeURIComponent(url.href);
}

app.get("/proxy", async (req, res) => {

    const target =
        parseTarget(req.query.url);

    if (!target) {
        return res.status(400).send(
            "Invalid URL."
        );
    }

    if (!isAllowed(target)) {
        return res.status(403).send(
            "This website is not enabled."
        );
    }

    try {

        const response =
            await fetch(target.href, {
                redirect: "follow",
                headers: {
                    "User-Agent": "EduView/1.0"
                }
            });

        if (!response.ok) {
            return res.status(
                response.status
            ).send(
                `Target returned HTTP ${response.status}.`
            );
        }

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "text/html"
            )
        ) {

            const html =
                await response.text();

            const $ =
                cheerio.load(html);

            $("a[href]").each(
                (_, element) => {

                    const href =
                        $(element).attr(
                            "href"
                        );

                    if (!href) return;

                    try {

                        const absolute =
                            new URL(
                                href,
                                target.href
                            );

                        if (
                            isAllowed(
                                absolute
                            )
                        ) {
                            $(element).attr(
                                "href",
                                proxiedUrl(
                                    absolute
                                )
                            );
                        }

                    } catch {}
                }
            );

            $("img[src]").each(
                (_, element) => {

                    const src =
                        $(element).attr(
                            "src"
                        );

                    if (!src) return;

                    try {

                        const absolute =
                            new URL(
                                src,
                                target.href
                            );

                        if (
                            isAllowed(
                                absolute
                            )
                        ) {
                            $(element).attr(
                                "src",
                                proxiedUrl(
                                    absolute
                                )
                            );
                        }

                    } catch {}
                }
            );

            $(
                'link[rel="stylesheet"][href]'
            ).each(
                (_, element) => {

                    const href =
                        $(element).attr(
                            "href"
                        );

                    if (!href) return;

                    try {

                        const absolute =
                            new URL(
                                href,
                                target.href
                            );

                        if (
                            isAllowed(
                                absolute
                            )
                        ) {
                            $(element).attr(
                                "href",
                                proxiedUrl(
                                    absolute
                                )
                            );
                        }

                    } catch {}
                }
            );

            res.set(
                "Content-Type",
                "text/html; charset=utf-8"
            );

            return res.send(
                $.html()
            );
        }

        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            );

        if (contentType) {
            res.set(
                "Content-Type",
                contentType
            );
        }

        return res.send(buffer);

    } catch (error) {

        console.error(error);

        return res.status(500).send(
            "Unable to retrieve webpage."
        );
    }
});

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `EduView running on port ${PORT}`
        );
    }
);
