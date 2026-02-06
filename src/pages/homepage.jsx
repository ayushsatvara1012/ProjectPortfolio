import Projects from '../components/projectSection'
import HeroSection from '../components/heroSection'
import Navbar from '../components/navbar'
function homepage() {
    return (
        <>
            <Navbar />
            <HeroSection/>
            <Projects />
        </>
    )
}

export default homepage