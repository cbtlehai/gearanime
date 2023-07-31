import {useEffect, useState} from 'react'
import './App.css'
import './assets/index.css'

function App() {
    const [input, setinput] = useState("https://www.gearanime.com/collections/j1-sneakers")
    const [count, setCount] = useState(0)
    const [getStatus, setGetStatus] = useState("Start")
    const [crawlStatus, setCrawlStatus] = useState("Start")
    const [countRs, setCountRs] = useState(0)
    const [processGet, setProcessGet] = useState<object>({})
    useEffect(()=>{
        const product_count = window.api.mb_ipcRenderer.receiveMsg("product_count",(data:number)=>{
            setCount(data)
        })

        const rs_count = window.api.mb_ipcRenderer.receiveMsg("rs_count",(data:number)=>{
            setCountRs(data)
        })
        return ()=>{
            if(product_count) product_count()
            if(rs_count) rs_count()
        }
    })
    const StartGet = (e: any) => {
        e.preventDefault();
        window.api.mb_ipcRenderer.sendMsg('actions_to_main', {
            action: getStatus.toLowerCase(),
            data: input
        });
        if(getStatus === "Stop"){
            setGetStatus("Start");
            return;
        }
        setProcessGet({})
        setGetStatus("Stop");
        window.api.mb_ipcRenderer.receiveMsg("link_page_count",(data:object)=>{
            setProcessGet((prev_c:object)=>{
                let new_cate = {...prev_c};
                new_cate[data.link] = data.page;
                return new_cate;
            })
        })
    }
    const ExportData = (e: any) => {
        e.preventDefault();
        window.api.mb_ipcRenderer.sendMsg('actions_to_main', {
            action: "export",
        });
    }
    const StartCrawl = (e: any) => {
        e.preventDefault();
        window.api.mb_ipcRenderer.sendMsg('actions_to_main', {
            action: crawlStatus.toLowerCase()+"-crawl"
        });
        if(crawlStatus === "Stop"){
            setCrawlStatus("Start");
            return;
        }
        setCrawlStatus("Stop");
    }
    return (
        <>
            <div className="input-cate">
                <textarea rows={15} value={input} onChange={(event) => {
                    console.log(event.target.value);
                    setinput(event.target.value)
                }
                }></textarea>
            </div>
            <div className="content">
                <button className={getStatus+"-btn"} onClick={StartGet}>{getStatus} Get</button>
                <button className={crawlStatus+"-btn"} onClick={StartCrawl}>{crawlStatus} Crawl</button>
                <button className={"export-btn"} onClick={ExportData}>Export to csv</button>
            </div>
            <p className="process-contain">
                <div>Tổng số sản phẩm tìm thấy: <b>{count}</b></div>
                <div>Thành công: <b>{countRs}</b></div>
                <div className="process-get-prds">
                    {
                        Object.keys(processGet).map((cate_link)=>{
                            return (
                                <>
                                    <div>{cate_link}: <b>{processGet[cate_link as keyof typeof processGet]} pages</b></div>
                                </>
                            )
                        })
                    }
                </div>
            </p>
        </>
    )
}

export default App
