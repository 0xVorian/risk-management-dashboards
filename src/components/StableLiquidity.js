import React, { Component} from 'react'
import {observer} from 'mobx-react'
import Box from "../components/Box"
import BoxRow from "../components/BoxRow"
import BoxGrid from "../components/BoxGrid"
import mainStore from "../stores/main.store"
import {whaleFriendlyFormater} from '../components/WhaleFriendly'

class StableLiquidity extends Component {

  render() {
    const loading = mainStore['lending_platform_current_loading']
    const rawData = mainStore['lending_platform_current_data'] || {}
    const { json_time } = rawData
    const {curveFraxBalance, curveVstBalance, prices} = rawData
    if(!prices){
      return null
    }
    return (
      <BoxGrid>
        <Box loading={loading} time={json_time}>
          <BoxRow>
            <h5 style={{margin: 0}}>VST Price</h5>
            <h5 style={{margin: 0}}>{whaleFriendlyFormater(prices.VST)}</h5>
          </BoxRow>
        </Box>
        <Box loading={loading} time={json_time}>
          <BoxRow>
            <h5 style={{margin: 0}}>VST Liquidity</h5>
            <h5 style={{margin: 0}}></h5>
          </BoxRow>          
          <BoxRow>
            <span style={{margin: 0}}>VST-FRAX</span>
            <span style={{margin: 0}}>{whaleFriendlyFormater(curveFraxBalance)}</span>
          </BoxRow>
          <BoxRow>
            <span style={{margin: 0}}>Curve</span>
            <span style={{margin: 0}}>{whaleFriendlyFormater(curveVstBalance)}</span>
          </BoxRow>
        </Box>
      </BoxGrid>
    )
  }
}

export default observer(StableLiquidity)