const fs = require("fs");
const path = require("path");

module.exports = async function afterPack(context) {
  const { rcedit } = await import("rcedit");
  const icon = path.join(context.packager.info.projectDir, "build", "icon.ico");
  if (!fs.existsSync(icon)) {
    console.warn("Skipping afterPack icon: build/icon.ico not found");
    return;
  }
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  if (!fs.existsSync(exePath)) {
    console.warn(`Skipping afterPack icon: ${exePath} not found`);
    return;
  }
  await rcedit(exePath, { icon });
  console.log(`Embedded app icon before packaging: ${exePath}`);
};
