import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";

const fontsDir = path.join(__dirname, "fonts");
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const FONTS_TO_DOWNLOAD: { name: string; url: string }[] = [
  // Image 1: Because Your Brian
  { name: "Romanesco-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/romanesco/Romanesco-Regular.ttf" },
  { name: "PlayfairDisplay-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bopsz%2Cwdth%2Cwght%5D.ttf" },
  { name: "PlayfairDisplay-Italic-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bopsz%2Cwdth%2Cwght%5D.ttf" },
  { name: "BodoniModa-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/BodoniModa%5Bopsz%2Cwght%5D.ttf" },
  { name: "BodoniModa-Italic-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/BodoniModa-Italic%5Bopsz%2Cwght%5D.ttf" },
  
  // Image 3: Giaza Beautifully Delicious
  { name: "AbrilFatface-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/abrilfatface/AbrilFatface-Regular.ttf" },
  { name: "GreatVibes-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf" },
  { name: "DancingScript-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/DancingScript%5Bwght%5D.ttf" },
  { name: "AlexBrush-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/alexbrush/AlexBrush-Regular.ttf" },
  
  // Image 4: EXTENDA Breathing
  { name: "BebasNeue-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf" },
  { name: "Anton-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf" },
  { name: "Oswald-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf" },
  { name: "Sacramento-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/sacramento/Sacramento-Regular.ttf" },

  // Image 6: the seasons TRUE TYPEWRITER
  { name: "CormorantGaramond-Italic-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf" },
  { name: "CourierPrime-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/courierprime/CourierPrime-Regular.ttf" },
  { name: "SpecialElite-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/specialelite/SpecialElite-Regular.ttf" },

  // Image 8: Symphony SANCHEZ
  { name: "PinyonScript-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/pinyonscript/PinyonScript-Regular.ttf" },
  { name: "Sanchez-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/sanchez/Sanchez-Regular.ttf" },
  { name: "RobotoSlab-Variable.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/robotoslab/RobotoSlab%5Bwght%5D.ttf" },

  // Image 33: NEXT gen
  { name: "VT323-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/vt323/VT323-Regular.ttf" },
  { name: "PressStart2P-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/PressStart2P-Regular.ttf" }
];

async function downloadFile(url: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          const stats = fs.statSync(destPath);
          resolve(stats.size);
        });
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log(`Starting download of ${FONTS_TO_DOWNLOAD.length} physical font files to ${fontsDir}...`);
  for (const font of FONTS_TO_DOWNLOAD) {
    const target = path.join(fontsDir, font.name);
    try {
      const size = await downloadFile(font.url, target);
      console.log(`✅ [SAVED] ${font.name} (${(size / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      console.warn(`⚠️ [SKIP] ${font.name}: ${e.message}`);
    }
  }
  console.log("\nAll target font assets are downloaded in docs/mini_run_studio/fonts/!");
}

run();
