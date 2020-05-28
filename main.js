const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
const task = require("./src/js/task");

const isMac = process.platform === "darwin" ? true : false;

let globalwebhook;
let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    title: "BBMonitor",
    titleBarStyle: "hiddenInset",
    backgroundColor: "white",
    webPreferences: {
      webSecurity: true,
      nodeIntegration: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "/src/index.html"));
};

app.on("ready", createWindow);

ipcMain.on("started:task", async (e, opts) => {
  try {
    const { sku, hook } = opts;
    mainWindow.webContents.send("running:task", "Searching for product...");

    return findProduct(sku, hook);
  } catch (err) {
    console.log(err);
    mainWindow.webContents.send("running:task", "Error Starting monitor");
  }
});

const findProduct = async (sku, hook, attempt = 1) => {
  const { data } = await axios({
    method: "GET",
    url: `https://www.bestbuy.com/api/3.0/priceBlocks?skus=${sku}`,
    headers: {
      "User-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36",
    },
  });

  const product = {
    Name: data[0].sku.names.short,
    Sku: data[0].sku.skuId,
    Price: `$${data[0].sku.price.currentPrice}`,
    Image: `https://pisces.bbystatic.com/image2/BestBuy_US/images/products/${data[0].sku.skuId.substr(
      0,
      4
    )}/${data[0].sku.skuId}_sa.jpg;maxHeight=1000;maxWidth=1000`,
    Status: data[0].sku.buttonState.buttonState,
    Url: `https://bestbuy.com${data[0].sku.url}`,
  };

  if (product.Status === "ADD_TO_CART") {
    mainWindow.webContents.send(
      "running:task",
      `Found Product! ${product.Name} for ${product.Price}`
    );

    task.send(product, hook);
    return true;
  } else {
    mainWindow.webContents.send(
      "running:task",
      `Product out of stock retrying... (Attempt: ${attempt})`
    );

    setTimeout(function () {
      let dayMillseconds = 1000 * 60;
      setInterval(function () {
        // repeat this every minute
        findProduct(sku, hook, attempt + 1);
      }, dayMillseconds);
    }, 0);
  }
};

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
