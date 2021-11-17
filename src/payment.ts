import { t } from '@lokavaluto/lokapi'
import { BridgeObject } from '@lokavaluto/lokapi/build/backend'


export class ComchainPayment extends BridgeObject implements t.IPayment {

    get amount () {
        return this.jsonData.comchain.amount
    }

    get date () {
        return this.jsonData.comchain.date
    }

    get description () {
        return this.jsonData.comchain.description
    }

    get from () {
        return this.jsonData.comchain.from
    }

    get id () {
        return this.jsonData.comchain.id
    }

    get to () {
        return this.jsonData.comchain.to
    }

}
