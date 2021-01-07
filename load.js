// request cURL
"use strict";

const httpTransport = require("https");
const slugg = require("slugg");
const got = require("got");
const responseEncoding = "utf8";

const grid = [];
const R = 0.01;
for (let x = -R; x < R; x += 0.002) {
  for (let y = -R; y < R; y += 0.002) {
    const ox = (Math.random() - 0.5) / 1000000;
    const oy = (Math.random() - 0.5) / 1000000;
    grid.push([38.88967308412251 + x + ox, -77.01094639508938 + y + oy]);
  }
}

async function load(ll, epoch) {
  return new Promise((resolve, reject) => {
    const httpOptions = {
      hostname: "ms.sc-jpl.com",
      port: "443",
      path: "/web/getPlaylist",
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.16; rv:84.0) Gecko/20100101 Firefox/84.0",
        Accept: "*/*",
        "Accept-Language": "en-US",
        Referer: `https://map.snapchat.com/story/587ca8b17bf7fdd4/snap/W7_EDlXWTBiXAEEniNoMPwAAY0xx0FnMlJ55jAXbYyQJvAXbYyQHeAO1OAA/@${ll},16.47z`,
        "Content-Type": "application/json",
        Origin: "https://map.snapchat.com",
        Dnt: "1",
        Connection: "keep-alive",
        Te: "Trailers",
      },
    };
    const request = httpTransport
      .request(httpOptions, (res) => {
        let responseBufs = [];
        let responseStr = "";

        if (res.statusCode >= 400) {
          console.error(`Resolved with ${res.statusCode}`);
          return resolve(undefined);
        }

        res
          .on("data", (chunk) => {
            if (Buffer.isBuffer(chunk)) {
              responseBufs.push(chunk);
            } else {
              responseStr = responseStr + chunk;
            }
          })
          .on("end", () => {
            responseStr =
              responseBufs.length > 0
                ? Buffer.concat(responseBufs).toString(responseEncoding)
                : responseStr;

            resolve(JSON.parse(responseStr));
          });
      })
      .setTimeout(0)
      .on("error", (error) => {
        reject(error);
      });

    const body = {
      requestGeoPoint: {
        lat: ll[0],
        lon: ll[1],
      },
      zoomLevel: 16.253499159574062,
      tileSetId: {
        flavor: "default",
        epoch,
        type: 1,
      },
      radiusMeters: 71.32103072756415,
      maximumFuzzRadius: 0,
    };
    request.write(JSON.stringify(body));
    request.end();
  });
}

async function getURLs() {
  const ts = await got
    .post("https://ms.sc-jpl.com/web/getLatestTileSet", {
      json: {},
    })
    .json();

  const epoch = ts.tileSetInfos.find((info) => info.id.type === "HEAT").id
    .epoch;
  console.error(`Map epoch: ${epoch}`);

  let mp4s = [].concat(
    ...(await Promise.all(
      grid.map(async (ll) => {
        const res = await load(ll, epoch);
        if (!res) return [];
        const mp4s = res.manifest.elements.map((element) => {
          const { streamingMediaInfo } = element.snapInfo;
          const video =
            streamingMediaInfo.prefixUrl + streamingMediaInfo.mediaUrl;
          return video;
        });
        return mp4s;
      })
    ))
  );

  mp4s = [...new Set(mp4s)].filter(Boolean);

  console.log(
    mp4s
      .map((f) => `wget -nc ${f} -O ${slugg(f)}.mp4`)
      .filter(Boolean)
      .join("\n")
  );
}

getURLs();
