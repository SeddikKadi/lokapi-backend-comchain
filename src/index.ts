import Jsc3lAbstract from '@com-chain/jsc3l'

import { t } from '@lokavaluto/lokapi'
import { mux } from '@lokavaluto/lokapi/build/generator'
import { BackendAbstract } from '@lokavaluto/lokapi/build/backend'

import { ComchainAccount } from './account'
import { ComchainRecipient } from './recipient'
import { ComchainTransaction } from './transaction'


interface IJsonDataWithAddress extends t.JsonData {
    address: string
}


export default abstract class ComchainBackendAbstract extends BackendAbstract {

    _jsc3l: Jsc3lAbstract

    get jsc3l () {
        if (!this._jsc3l) {
            const {
                httpRequest,
                persistentStore,
            } = this
            class Jsc3l extends Jsc3lAbstract {
                persistentStore = persistentStore
                httpRequest = async (opts) => {
                    if (opts.method === 'POST') {
                        opts.headers = opts.header || {}
                        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
                    }
                    const data = await httpRequest(opts)
                    try {
                        return JSON.parse(<string>data)
                    } catch (e) {
                        return data
                    }
                }
            }
            this._jsc3l = new Jsc3l()
        }
        return this._jsc3l
    }

    private getSubBackend (jsc3l: Jsc3lAbstract, jsonData: IJsonDataWithAddress) {
        return new ComchainUserAccount({
            comchain: jsc3l,
            ...this.backends
        }, this, jsonData)
    }

    private get userAccounts () {
        if (!this._userAccounts) {
            this._userAccounts = {}
            this.jsonData.accounts.forEach(
                (bankAccountData: IJsonDataWithAddress) => {
                    const comchainUserAccount = this.getSubBackend(
                        this.jsc3l,
                        bankAccountData
                    )
                    this._userAccounts[
                        comchainUserAccount.internalId
                    ] = comchainUserAccount
                }
            )
        }
        return this._userAccounts
    }

    private _userAccounts: any


    public async getAccounts (): Promise<any> {
        const backendBankAccounts = []
        for (const id in this.userAccounts) {
            const userAccount = this.userAccounts[id]
            const bankAccounts = await userAccount.getAccounts()
            bankAccounts.forEach((bankAccount: any) => {
                backendBankAccounts.push(bankAccount)
            })
        }
        return backendBankAccounts
    }


    public makeRecipients (jsonData: t.JsonData): t.IRecipient[] {
        const recipients = []
        if (Object.keys(this.userAccounts).length === 0) {
            throw new Error(
                'Current user has no account in comchain. Unsupported yet.'
            )
        }
        if (Object.keys(this.userAccounts).length > 1) {
            // We will need to select one of the source userAccount of the
            // current logged in user
            throw new Error(
                'Current user has more than one account in comchain. ' +
                    'Unsupported yet.'
            )
        }
        jsonData.monujo_backends[this.internalId].forEach((address: string) => {
            // Each ownerId here is a different account in comchain for recipient
            recipients.push(
                new ComchainRecipient(
                    {
                        comchain: Object.values(this.userAccounts)[0],
                        ...this.backends,
                    },
                    this,
                    {
                        odoo: jsonData,
                        comchain: { address },
                    }
                )
            )
        })
        return recipients
    }

    public async * getTransactions (order:any): AsyncGenerator {
        yield * mux(
            Object.values(this.userAccounts).map(
                (u: ComchainUserAccount) => u.getTransactions(order)),
            order
        )
    }

}


export class ComchainUserAccount {

    address: string
    parent: BackendAbstract
    backends: { [index: string]: any }
    jsonData: { [index: string]: any }


    constructor (backends, parent, jsonData) {
        this.address = jsonData.wallet.address
        this.parent = parent
        this.backends = backends
        this.jsonData = jsonData
    }

    private async getCurrencyMgr () {
        if (!this._currencyMgrPromise) {
            // This will trigger the discovery of master servers and load
            // the server conf of the currency.
            this._currencyMgrPromise = this.backends.comchain.getCurrencyMgr(
                this.jsonData.wallet.server.name,
            )
        }
        return await this._currencyMgrPromise
    }

    _currencyMgrPromise: { [index: string]: any }


    /**
     * In the current implementation, a user is identified by its wallet, and as
     * such, it is also having only one account.
     *
     */
    async getAccounts () {
        const accounts = []
        const currencyMgr = await this.getCurrencyMgr()
        if (currencyMgr.customization.hasNant()) {
            accounts.push(
                new ComchainAccount(
                    { comchain: currencyMgr, ...this.backends },
                    this,
                    {
                        comchain: {
                            address: this.jsonData.address,
                            type: 'Nant'
                        },
                    })
            )
        }
        if (currencyMgr.customization.hasCM()) {
            accounts.push(
                new ComchainAccount(
                    { comchain: this, ...this.backends },
                    this, {
                        comchain: { type: 'Cm' },
                    })
            )
        }
        return accounts
    }

    get internalId () {
        return `comchain:${this.address}`
    }

    public async * getTransactions (order: any): AsyncGenerator {
        const currencyMgr = await this.getCurrencyMgr()
        const addressResolve = {}
        const limit = 30
        let offset = 0
        while (true) {
            const transactionsData = await currencyMgr.ajaxReq.getTransList(
                `0x${this.address}`, limit, offset)
            const uniqueAddresses = transactionsData.map(
                (t: any) => t.addr_to.substring(2)
            ).filter(
                (t: any, idx: number, self) => self.indexOf(t) === idx
            ).filter(
                (t: any) => (typeof addressResolve[t] === 'undefined')
            )
            if (uniqueAddresses.length > 0) {
                const partners = await this.backends.odoo.$post('/comchain/partners', {
                    addresses: uniqueAddresses,
                })
                for (const k in partners) {
                    addressResolve[k] = partners[k]
                }
            }
            for (let idx = 0; idx < transactionsData.length; idx++ ) {
                const transactionData = transactionsData[idx]
                if (transactionData.addr_to === `0x${this.address}`) {
                    yield new ComchainTransaction(
                        {
                            ...this.backends,
                            ...{ comchain: currencyMgr }
                        },
                        this,
                        {
                            comchain: Object.assign({}, transactionData, {
                                amount: transactionData.recieved
                            }),
                            odoo: addressResolve
                        }
                    )
                }
                if (transactionData.addr_from === `0x${this.address}`) {
                    yield new ComchainTransaction(
                        {
                            ...this.backends,
                            ...{ comchain: currencyMgr }
                        },
                        this,
                        {
                            comchain: Object.assign({}, transactionData, {
                                amount: -transactionData.sent
                            }),
                            odoo: addressResolve
                        }
                    )
                }
            }
            if (transactionsData.length < limit) {
                return
            }
            offset += limit
        }
    }


}





