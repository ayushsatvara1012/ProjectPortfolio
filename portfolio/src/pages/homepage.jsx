import { ArrowRight, Code, Server, Shield, Zap } from 'lucide-react';
import Projects from '../components/projectSection'
import HeroSection from '../components/heroSection'
import AppTest from '../App.test'
function homepage() {
    return (
        <>
            <HeroSection/>
            <Projects />
            {/* <AppTest /> */}
        </>
    )
}

export default homepage