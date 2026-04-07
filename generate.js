import fs from "fs";
import fetch from "node-fetch";

const TMDB_KEY = process.env.TMDB_API_KEY;

// load your JSON
const data = JSON.parse(
  fs.readFileSync("./streamtape_videos.json", "utf-8")
);

// group by ID
const grouped = {};

for (const file of data.files) {
  const id = file.mal_id || file.anilist_id || file.tmdb_id;
  if (!id) continue;

  if (!grouped[id]) {
    grouped[id] = {
      id,
      type: file.mal_id ? "mal" : file.tmdb_id ? "tmdb" : "anilist",
      files: []
    };
  }

  grouped[id].files.push(file);
}

// fetch AniList title
async function getAniListTitle(mal_id) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query ($id: Int) {
          Media(idMal: $id, type: ANIME) {
            title {
              romaji
              english
            }
          }
        }
      `,
      variables: { id: parseInt(mal_id) }
    })
  });

  const json = await res.json();
  return (
    json?.data?.Media?.title?.english ||
    json?.data?.Media?.title?.romaji ||
    "Unknown"
  );
}

// fetch TMDB title
async function getTMDBTitle(id) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}`
  );
  const json = await res.json();
  return json.title || "Unknown";
}

// extract episode + date
function parseTitle(title) {
  const match = title.match(/\[(\d+)-(\d+)\] \[(.*?)\] \[(.*?)\]/);
  if (!match) return { ep: "?", name: title, date: "" };

  return {
    ep: match[2],
    name: match[3],
    date: match[4]
  };
}

(async () => {
  let htmlBlocks = "";

  for (const key of Object.keys(grouped)) {
    const group = grouped[key];

    let title = "Unknown";

    if (group.type === "mal") {
      title = await getAniListTitle(group.id);
    } else if (group.type === "tmdb") {
      title = await getTMDBTitle(group.id);
    }

    let episodesHTML = "";

    for (const file of group.files) {
      const parsed = parseTitle(file.title);
      episodesHTML += `<p>[${parsed.ep}] ${parsed.date}</p>`;
    }

    htmlBlocks += `
      <div class="bg-gray-800 rounded-xl p-4 shadow">
        <h2 class="text-xl font-semibold">${title}</h2>
        <div class="text-sm text-gray-400 mt-1 uppercase">
          ${group.type.toUpperCase()} ID: ${group.id}
        </div>
        <div class="mt-3 space-y-1 text-sm">
          ${episodesHTML}
        </div>
      </div>
    `;
  }

  const finalHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anime List</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-gray-100">
  <div class="max-w-5xl mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Anime Library</h1>
    <div class="space-y-4">
      ${htmlBlocks}
    </div>
  </div>
</body>
</html>
`;

  fs.writeFileSync("a-list.html", finalHTML);
})();
