import Github from '../assets/github-logo.png'
const Projects = () => {
  return (
    <section id="projects" className="py-24 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Selected <span className="text-indigo-600">Architectures.</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl text-lg">
            A look into the systems we've designed, developed, and deployed. From modular frontends to scalable backends.
          </p>
        </div>
        {/* Projects Cards */}
        <div className="w-full grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="w-full h-100 flex flex-col gap-2 items-center justify-around bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="w-full h-3/5 rounded-2xl bg-indigo-50 items-center flex justify-center">Image</div>
                <p className="p-2">Description : Lorem ipsum dolor sit amet Lorem ipsum dolor sit amet</p>
                <div className="w-full h-10 flex flex-row gap-3 justify-around">
                    <button className='w-1/2 flex flex-row gap-3 border border-gray-500 p-2 rounded-xl items-center justify-center hover:bg-gray-50'>
                    <img src={Github} className='w-5 h-5' alt="" />
                    <p>Github</p>
                    </button>
                    <button className='w-1/2 text-indigo-700 border rounded-xl border-indigo-400 hover:bg-indigo-50'>Check Out</button>
                </div>
            </div>
            <div className="w-full h-100 flex flex-col gap-2 items-center justify-around bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="w-full h-3/5 rounded-2xl bg-indigo-50 items-center flex justify-center">Image</div>
                <p className="p-2">Description : Lorem ipsum dolor sit amet Lorem ipsum dolor sit amet</p>
                <div className="w-full h-10 flex flex-row gap-3 justify-around">
                    <button className='w-1/2 flex flex-row gap-3 border border-gray-500 p-2 rounded-xl items-center justify-center hover:bg-gray-50'>
                    <img src={Github} className='w-5 h-5' alt="" />
                    <p>Github</p>
                    </button>
                    <button className='w-1/2 text-indigo-700 border rounded-xl border-indigo-400 hover:bg-indigo-50'>Check Out</button>
                </div>
            </div>
            <div className="w-full h-100 flex flex-col gap-2 items-center justify-around bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="w-full h-3/5 rounded-2xl bg-indigo-50 items-center flex justify-center">Image</div>
                <p className="p-2">Description : Lorem ipsum dolor sit amet Lorem ipsum dolor sit amet</p>
                <div className="w-full h-10 flex flex-row gap-3 justify-around">
                    <button className='w-1/2 flex flex-row gap-3 border border-gray-500 p-2 rounded-xl items-center justify-center hover:bg-gray-50'>
                    <img src={Github} className='w-5 h-5' alt="" />
                    <p>Github</p>
                    </button>
                    <button className='w-1/2 text-indigo-700 border rounded-xl border-indigo-400 hover:bg-indigo-50'>Check Out</button>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Projects;