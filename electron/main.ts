import {app, BrowserWindow, ipcMain} from 'electron'
import path from 'node:path'
import HTMLParse from 'node-html-parser'
import axios from 'axios'
import fs, {mkdirSync} from 'fs'
import os from 'os';

const dataPath = path.join(os.homedir(), "CrawlData")
if (!fs.existsSync(dataPath)) {
    mkdirSync(dataPath)
}
// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            devTools: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString());
        listenActions();
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

let products = {};
let crawled_products= {};
loadProducts();
app.on('window-all-closed', () => {
    saveAllData()
    win = null
})

app.whenReady().then(createWindow)
let getStatus = false;
let crawlStatus = false;

function saveAllData() {
    saveProducts();
    saveCrawledProducts();
}

function listenActions() {
    ipcMain.on("actions_to_main", (event, args) => {
        switch (args.action) {
            case "start":
                getStatus = true;
                if (args.data !== "") {
                    startGetProducts(args.data)
                }
                break;
            case "stop":
                getStatus = false;
                saveAllData();
                break;
            case "start-crawl":
                crawlStatus = true;
                break;
            case "stop-crawl":
                crawlStatus = false;
                saveAllData();
                break;
            case "export":
                exportData();
                break;
        }
    });
}

function exportData() {
    let datas = ["Name,Image Urls,Category Url"];
    Object.keys(crawled_products).map((link) => {
        datas.push(crawled_products[link].title + ",\"" + crawled_products[link].images + "\"," + crawled_products[link].cate)
    });
    fs.writeFileSync(path.join(dataPath, Object.keys(crawled_products).length + "-products-" + Date.now() + ".csv"), datas.join("\n"));
    crawled_products = {};
    saveAllData();
}

async function startGetProducts(data) {
    const links = data.split("\n");
    console.log(links)
    links.map((link) => {
        getProductFromCateLink(link)
    })
}

let max_thread = 5;
let thread = 0;
setInterval(async () => {
    if (crawlStatus && Object.keys(products).length > 0 && thread <= max_thread) {
        thread++;
        console.log("Start get Pr", thread)
        await getProductInfo();
        console.log("Done get Pr", thread)
        thread--;
    }
}, 1000);

async function getProductInfo() {
    return new Promise(async (resolve) => {
        let product_url = "";
        try {
            product_url = Object.keys(products)[0];
            console.log("getProductInfo", product_url)
            const product_cate_url = products[Object.keys(products)[0]].cate_url;
            if (!crawled_products.hasOwnProperty(product_url)) {
                const product_html = await axios.get(product_url);
                const _p_docs = HTMLParse.parse(product_html.data)
                const _p_title = _p_docs.querySelector(".h3.product__name").innerText;
                const _p_images = _p_docs.querySelectorAll("#product-image-gallery .VueCarousel-inner > div");
                let img_links = [];
                _p_images.map((img) => {
                    const _img_link = img.getAttribute("data-key");
                    img_links.push(_img_link)
                });
                crawled_products[product_url] = {
                    title: _p_title,
                    images: img_links.join(","),
                    cate: product_cate_url,
                }

            }
            delete products[product_url];
            resolve(true)
        } catch (e) {
            console.log("getProductInfo error", product_url, e)
            resolve(false);
        }
    })
}

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function getProductFromCateLink(link, page = 1, toltal_page = 0) {
    if (getStatus) {
        axios.get(link + "?page=" + page + "&limit=48&sort_direction=desc&sort_field=manual")
            .then(async resp => {
                const _docs = HTMLParse.parse(resp.data)
                if (page === 1) {
                    toltal_page = parseInt(_docs.querySelectorAll('.pagination-list li:last-child')[0].innerText);
                    console.log("toltal_page:", toltal_page)
                }
                const _list = _docs.querySelectorAll(".collection-product-wrap.relative > a");
                console.log(_list.length)
                _list.map((p) => {
                    const _url = new URL(link);
                    const _hr = _url.origin + p.getAttribute("href");
                    if (!products.hasOwnProperty(_hr)) {
                        products[_hr] = {
                            cate_url: link
                        }
                    }
                })
                win.webContents.send("link_page_count", {
                    link: link,
                    page: page + "/" + toltal_page
                });
                page++;
                if (page <= toltal_page) {
                    await sleep(5000);
                    getProductFromCateLink(link, page, toltal_page);
                }

            })
            .catch(err => {
                // console.log(err);
                return false;
            });
    }
}

setInterval(() => {
    try {
        win.webContents.send("product_count", Object.keys(products).length);
        win.webContents.send("rs_count", Object.keys(crawled_products).length);
    } catch (e) {

    }
}, 2000)

function saveProducts() {
    fs.writeFileSync(path.join(dataPath, "products.txt"), JSON.stringify(products));
}

function saveCrawledProducts() {
    fs.writeFileSync(path.join(dataPath, "crawled_products.txt"), JSON.stringify(crawled_products));
}

function loadProducts() {
    if (!fs.existsSync(path.join(dataPath, "products.txt"))) fs.writeFileSync(path.join(dataPath, "products.txt"), "{}");
    if (!fs.existsSync(path.join(dataPath, "crawled_products.txt"))) fs.writeFileSync(path.join(dataPath, "crawled_products.txt"), "{}");
    products = JSON.parse(fs.readFileSync(path.join(dataPath, "products.txt"), "utf-8") ?? "{}");
    crawled_products = JSON.parse(fs.readFileSync(path.join(dataPath, "crawled_products.txt"), "utf-8") ?? "{}");
}
