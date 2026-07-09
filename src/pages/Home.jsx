import Hero from '../components/Hero'
import SeccoesCasa from '../components/SeccoesCasa'

// Home rica: Hero de sempre + secções-teaser do que a casa serve.
// O botão "Conhecer a casa" do Hero scrolla para #a-casa (SeccoesCasa).
function Home() {
  return (
    <>
      <Hero />
      <SeccoesCasa />
    </>
  )
}

export default Home
