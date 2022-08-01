import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers,ethers} from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { useState,useEffect } from "react";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup"
import {object,string, number,array,InferType,TypeOf} from "yup";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
const schema =object({
    Name: string().required("Name is required"),
    Age:number().typeError("Age must be a number")
    .required("Age is required")
    .min(13,"The minimum is 13"),
    Address: string().required("Address is required")
})
type Props = InferType<typeof schema>
const provider = new providers.JsonRpcProvider("http://localhost:8545")
const signer =provider.getSigner();
const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi,signer)

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const {register,handleSubmit,formState: {errors}, } = useForm<Props>({
        resolver: yupResolver(schema)
    });
    const [data,setData] = useState("");
    const[greetings,setGreeting] =React.useState<string>();
    

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
            
        }
    }

    
    useEffect(() => {
        if (data) {
            console.log(data)
        }
    },[data])
    useEffect(() => {
        const displayEvent =(greeting:string) => {
            console.log(ethers.utils.parseBytes32String(greeting))
            setGreeting(ethers.utils.parseBytes32String(greeting))

        }
        
        if(contract) {
            contract.on('NewGreeting',displayEvent)
        }
        return () =>{
            if (contract) {
                contract.off('NewGreeting',displayEvent)
            }
        }
    })
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>

            </main>
            <p>When a Newgreeting event is received, a message is displayed below.</p>
            <p>{greetings}</p>
            <form  onSubmit={handleSubmit((data) => setData(JSON.stringify(data)))}>
                <input {...register("Name")} placeholder="Your name" />
                <span className={styles.error}> {errors.Name?.message}</span>
                <input {...register("Age")} placeholder="Your age" />
                <span className={styles.error}> {errors.Age?.message}</span>
                <input {...register("Address")} placeholder="Your address" />
                <span className={styles.error}> {errors.Address?.message}</span>
              <p>{data}</p>
              <input type="submit" value="Submit"/>
            </form>
        </div>
    )
}
