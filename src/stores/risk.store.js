import { makeAutoObservable, runInAction } from "mobx"
import Solver from "../risk/solver"
import mainStore from '../stores/main.store'

const tweakCurrentCap = cap => {
  if (cap === '0' || cap === 0) {
    return Infinity
  }
  if (cap === '1'  || cap === 1){
    return '0'
  }
  return cap
}

class RiskStore {
  data = [] 
  currentData = []
  utilization = []
  loading = true
  incrementationOptions = {}
  recommendations = []
  constructor (){
    this.initPromise = this.init()
    makeAutoObservable(this)
  }

  init = async ()=> {
    if(true) {
      const data = await mainStore['risk_params_request']
      this.utilization = await mainStore['accounts_request']
        .then(u=> {
          return Object.entries(u)
          .map(([k, v])=> {
            if(k == 'json_time'){
              return null
            }
            return { 
              asset: k,
              mint_cap: v.total_collateral,
              borrow_cap: v.total_debt
            }
          })
          .filter(o=> o)
        })
      this.currentData = await mainStore['lending_platform_current_request']
        .then(d => {
          const clean = {}
          for (let asset in d.borrow_caps) {
            clean[asset] = { asset }
            debugger
            clean[asset].borrow_cap = tweakCurrentCap(d.borrow_caps[asset])
            clean[asset].mint_cap = tweakCurrentCap(d.collateral_caps[asset])
            clean[asset].current_collateral_factor = d.collateral_factors[asset]
          }
          return Object.values(clean)
        })
      this.rawData = Object.assign({}, data || {})
      const {json_time} = this.rawData
      if(json_time){
        delete this.rawData.json_time
      }
      // inctanciate a solver
      this.solver = new Solver(this.rawData)
      this.solveFor(this.utilization)
      this.solveFor(this.currentData)
      console.log("caps", this.solver.caps)
      runInAction(()=> {
        this.incrementationOptions = this.solver.caps
        console.log(this.incrementationOptions)
        // const sorted = riskData.sort((a,b)=> a.asset.localeCompare(b.asset))
        // this.data = sorted
        this.solve()
        this.loading = false
      })
    }
  }

  getRecommendations = async () => {
    await this.initPromise
    return [this.utilization, this.currentData]
  }

  incrament = (row, field) => {
    // find the options
    const options = this.incrementationOptions[row.asset] || []
    console.log({options})
    // find the index of exisiting value
    const currentIndex = options.indexOf(row[field])
    // validate we can incrament or decrament
    if(currentIndex == -1 ){
      console.log('cant incrament 1')
      return
    }
    if(currentIndex === options.length - 1){
      console.log('cant incrament 2')
      return
    }
    // cahnge the value
    row[field] = options[currentIndex+1]
    this.solve()
    console.log('incrament')
  }

  clearDiffs = () => {
    if(this.timeOutId){
      //clear timeOut
      clearTimeout(this.timeOutId)
    }
    this.timeOutId = setTimeout(() => {
      runInAction(()=> {
        this.data = this.data.map(r => {
          r.diff = false
          return r
        })
      })
    }, 5000)
  }

  solve = () => {
    // generate mintCaps, borrowCaps & collateralFactorCaps objects
    const mintCaps = {}
    const borrowCaps = {}
    const collateralFactorCaps = {}
    if(this.data.length){
      this.data.forEach(row => {
        mintCaps[row.asset] = row.mint_cap
        borrowCaps[row.asset] = row.borrow_cap
        collateralFactorCaps[row.asset] = 0
      })
    } else {
      Object.entries(this.solver.caps).forEach(([k, v])=> {
        const max = v[v.length - 1]
        mintCaps[k] = max
        borrowCaps[k] = max
        collateralFactorCaps[k] = 0
      })
    }
    const newRiskParameters = this.solver.optimizeCfg(this.solver.findValidCfg(mintCaps, borrowCaps, collateralFactorCaps))
    
    this.recommendations = this.solver.recommendations(newRiskParameters)
    // then rebuild data object from new configurations
    const newTableData = {}
    Object.entries(newRiskParameters.mintCaps).forEach(([k, v])=> {
      newTableData[k] = newTableData[k] || {asset: k}
      newTableData[k].mint_cap = v
    })
    Object.entries(newRiskParameters.borrowCaps).forEach(([k, v])=> {
      newTableData[k] = newTableData[k] || {asset: k}
      newTableData[k].borrow_cap = v
    })
    Object.entries(newRiskParameters.cfs).forEach(([k, v])=> {
      newTableData[k] = newTableData[k] || {asset: k}
      newTableData[k].collateral_factor = v
    })
    // look for diffs and add theme
    this.data.forEach(row=> {
      const cf = row.collateral_factor
      const newCf = newTableData[row.asset].collateral_factor
      if(!cf || cf === newCf) {
        newTableData[row.asset].diff = false
        return
      }
      newTableData[row.asset].diff = newCf - cf
    })
    // then rerender
    runInAction(()=> {
      this.data = (Object.values(newTableData)).sort((a,b)=> a.asset.localeCompare(b.asset))
    })
    this.clearDiffs()
  }

  findCap = (asset, value) => {
    const caps = this.solver.caps[asset]
    if(value === Infinity){
      return caps[caps.length - 1]
    }
    for(let cap of caps){
      if(cap * 1000000 >= value){
        return cap
      }
    }
  }

  solveFor = (dataSet) => {
    // generate mintCaps, borrowCaps & collateralFactorCaps objects
    const mintCaps = {}
    const borrowCaps = {}
    const collateralFactorCaps = {}
    if(dataSet.length){
      dataSet.forEach(row => {
        mintCaps[row.asset] = this.findCap(row.asset, row.mint_cap)
        borrowCaps[row.asset] = this.findCap(row.asset, row.borrow_cap)
        collateralFactorCaps[row.asset] = 0
      })
    }
    const newRiskParameters = this.solver.optimizeCfg(this.solver.findValidCfg(mintCaps, borrowCaps, collateralFactorCaps))
    
    //this.recommendations = this.solver.recommendations(newRiskParameters)
    // then rebuild data object from new configurations
    const newTableData = {}
    Object.entries(newRiskParameters.mintCaps).forEach(([k, v])=> {
      newTableData[k] = newTableData[k] || {asset: k}
      newTableData[k].mint_cap = v
    })
    Object.entries(newRiskParameters.borrowCaps).forEach(([k, v])=> {
      newTableData[k] = newTableData[k] || {asset: k}
      newTableData[k].borrow_cap = v
    })
    Object.entries(newRiskParameters.cfs).forEach(([k, v])=> {
      newTableData[k] = newTableData[k] || {asset: k}
      newTableData[k].collateral_factor = v
    })

    // then rerender
    runInAction(()=> {
      dataSet = dataSet.map(r=> {
        r.collateral_factor = newTableData[r.asset].collateral_factor
        r.debug_mc = newTableData[r.asset].mint_cap
        r.debug_bc = newTableData[r.asset].borrow_cap
        return r
      })//(Object.values(newTableData)).sort((a,b)=> a.asset.localeCompare(b.asset))
    })
  }

  decrament = (row, field) => {
    // find the options
    const options = this.incrementationOptions[row.asset] || []
    // find the index of exisiting value
    const currentIndex = options.indexOf(row[field])
    // validate we can incrament or decrament
    if(currentIndex == -1 ){
      console.log('cant decrament 1')
      return
    }
    if(currentIndex === 0){
      console.log('cant decrament 2')
      return
    }
    // cahnge the value
    row[field] = options[currentIndex-1]
    this.solve()
    console.log('decrament')
  }

  getCurrentCollateralFactor = (asset) => {
    const [{current_collateral_factor }] = this.currentData.filter(r => r.asset === asset)
    return current_collateral_factor
  }

  preformRecommendation = (recommendation) => {
    // decrease ADA.e mint cap to 40
    const [operation, asset, type, , , amount] = recommendation.split(' ')
    for (let row of this.data) {
      if(row.asset === asset){
        row[`${type}_cap`] = amount
        this.solve()
        break;
      }
    }
  }
}

export default new RiskStore()